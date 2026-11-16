"""Agent orchestrator: input guardrails -> LLM -> tool request -> authorization -> tool guardrails -> execution
-> LLM -> output guardrails. Any guardrail failure fails closed (ERROR message, `guardrail_error` logged)."""
import json
import time
import uuid
from collections import Counter
from dataclasses import dataclass

from datetime import timedelta

from sqlalchemy.orm import Session

from app.agent.authorization import authorize_tool_call
from app.agent.context import Principal
from app.agent.prompts import system_prompt
from app.agent.tools import schemas_for_role
from app.config import get_settings
from app.llm import LLMError, get_llm
from app.repositories import conversations as convs
from app.guardrails import messages as msg
from app.guardrails import tool_guards as tg
from app.guardrails.input_guards import ID_RE, Finding
from app.guardrails.pipeline import SANDWICH, SANDWICH_STRONG, run_input, run_output
from app.guardrails.rate_limit import limiter
from app.db.base import utcnow
from app.models.db import Conversation, Message
from app.services.logging import write_agent_log

HISTORY_LIMIT = 20
MAX_CONVERSATION_MESSAGES = 100


class ConversationNotFound(Exception):
    pass


class RateLimited(Exception):
    def __init__(self, message: str):
        self.message = message


@dataclass
class ChatResult:
    request_id: str
    conversation_id: str
    reply: str
    blocked: bool = False


def handle_chat(db: Session, ctx: Principal, message: str, conversation_id: str | None, request_id: str | None = None) -> ChatResult:
    started = time.perf_counter()
    request_id = request_id or str(uuid.uuid4())
    settings = get_settings()
    provider = get_llm()
    degraded = settings.guardrails_degraded
    state = {"query": message}  # replaced by the redacted text once input guards ran

    def ms() -> int:
        return int((time.perf_counter() - started) * 1000)

    def log(**kw):
        kw.setdefault("conversation_id", None)
        kw.setdefault("requested_resource", None)
        kw.setdefault("tool_calls", [])
        kw.setdefault("llm_raw_response", [])
        kw.setdefault("final_response", "")
        kw.setdefault("guardrail_events", [])
        return write_agent_log(db, request_id=request_id, user_id=ctx.user_id, username=ctx.username, query=state["query"], latency_ms=ms(),
                               guardrails_degraded=degraded, llm_provider=provider.name, llm_model=provider.model, **kw)

    # conversation ownership (another user's conversation looks exactly like a missing one)
    conv = None
    if conversation_id:
        conv = convs.get_owned(db, ctx, conversation_id)
        if conv is None:
            log(requested_resource=f"conversation:{conversation_id}"[:128], authorization_result="denied",
                authorization_reason="conversation not owned")
            raise ConversationNotFound()

    # §5.4.2a rate limit + lockout (before anything else is evaluated)
    if settings.guardrails_input:
        for blocked_msg, check, why in ((msg.LOCKOUT, lambda: limiter.locked(ctx.user_id), "lockout"),
                                        (msg.RATE_LIMIT, lambda: not limiter.allow_request(ctx.user_id), "rate limit")):
            if check():
                log(authorization_result="denied", authorization_reason=why, final_response=blocked_msg,
                    blocked_by=why.replace(" ", "_"),
                    guardrail_events=[Finding("input", why, "high", rule_id=why.replace(" ", "_"), action="block").as_dict()])
                raise RateLimited(blocked_msg)

    # §5.4.2b conversation size
    if conv is not None and convs.count_messages(db, conv) >= MAX_CONVERSATION_MESSAGES:
        log(conversation_id=conv.id, authorization_result="none", final_response=msg.CONVERSATION_FULL,
            guardrail_events=[Finding("input", "conversation_full", "info", rule_id="conversation_full", action="block").as_dict()])
        return ChatResult(request_id, str(conv.id), msg.CONVERSATION_FULL, blocked=True)

    is_new = conv is None
    if is_new:
        conv = Conversation(id=uuid.uuid4(), user_id=ctx.user_id, session_id=ctx.jti, title="")

    def finish(reply, findings, tool_log=(), raw=(), auth="none", reason=None, resource=None, out_filter=None, blocked=False,
               blocked_by=None, tainted=False, error=False):
        if is_new:
            conv.title = state["query"][:40]
            db.add(conv)
            db.flush()
        if error and not blocked_by:
            blocked_by = next((f.rule_id for f in reversed(findings) if f.action == "block"), None)
        now = utcnow()
        db.add(Message(conversation_id=conv.id, role="user", content=state["query"], request_id=request_id, created_at=now, blocked=blocked or error))
        db.add(Message(conversation_id=conv.id, role="assistant", content=reply, request_id=request_id, created_at=now + timedelta(microseconds=10), blocked=blocked or error))
        conv.updated_at = now
        db.commit()
        if blocked and settings.guardrails_input:
            limiter.record_block(ctx.user_id)
        log(conversation_id=conv.id, requested_resource=resource, tool_calls=list(tool_log), authorization_result=auth,
            authorization_reason=reason, output_filter=out_filter, llm_raw_response=list(raw), final_response=reply,
            guardrail_events=[f.as_dict() for f in findings], blocked_by=blocked_by, tainted=tainted)
        return ChatResult(request_id, str(conv.id), reply, blocked)

    findings: list[Finding] = []
    try:
        return _run(db, ctx, message, conv, is_new, state, findings, finish)
    except Exception as e:  # noqa: BLE001 - fail closed: never pass unchecked content through
        db.rollback()
        findings.append(Finding("output", "guardrail_error", "high", type(e).__name__, rule_id="guardrail_error", action="block"))
        return finish(msg.ERROR, findings, error=True)


def _run(db, ctx, message, conv, is_new, state, findings, finish) -> ChatResult:
    settings = get_settings()
    llm = get_llm()

    # §5.4.1-2 input guardrails
    verdict = run_input(db, ctx, message, llm)
    state["query"] = verdict.message
    findings.extend(verdict.findings)
    if verdict.block:
        reasons = {"cross_user": "cross-user access", "system_prompt": "system prompt extraction",
                   "injection": "prompt injection", "out_of_scope": "out of scope"}
        return finish(verdict.reply, findings, auth="denied", reason=reasons[verdict.block], resource=verdict.resource, blocked=True,
                      blocked_by=verdict.blocked_by)

    # §5.4.3 prompt construction: hierarchy, minimal context, clean history, sandwich reminder
    history = [] if is_new else convs.history(db, conv)
    verified_ids = {x.upper() for h in history if h.role == "assistant" for x in ID_RE.findall(h.content)}
    messages = [{"role": "system", "content": system_prompt()}, *({"role": h.role, "content": h.content} for h in history),
                {"role": "user", "content": verdict.message},
                {"role": "system", "content": SANDWICH_STRONG if verdict.flagged else SANDWICH}]
    if verdict.flagged:
        findings.append(Finding("prompt", "flagged", "medium", "stronger sandwich reminder used", rule_id="strong_reminder"))
    tools = schemas_for_role(ctx.role)
    boundary = tg.new_boundary_id()
    guard_tools = settings.guardrails_tool

    tool_log, raw_log = [], []
    denied_reason = denied_resource = None
    final = None
    tainted = False
    per_tool: Counter = Counter()
    executed = 0
    seen: dict[str, dict] = {}

    for _ in range(settings.agent_max_tool_iterations):
        try:
            resp = llm.chat(messages, tools)
        except LLMError as e:
            findings.append(Finding("prompt", "llm_error", "high", str(e), rule_id="llm_error", action="block"))
            return finish(msg.ERROR, findings, tool_log, raw_log, error=True)
        raw_log.append(resp.raw)
        if not resp.tool_calls:
            final = resp.content or ""
            break
        messages.append({
            "role": "assistant", "content": resp.content,
            "tool_calls": [{"id": tc.id, "type": "function", "function": {
                "name": tc.name, "arguments": tc.arguments if isinstance(tc.arguments, str) else json.dumps(tc.arguments)}}
                for tc in resp.tool_calls],
        })
        for tc in resp.tool_calls:
            args = tc.arguments if isinstance(tc.arguments, dict) else {"_raw": str(tc.arguments)[:200]}
            entry = {"tool": tc.name, "arguments": args}
            decision = authorize_tool_call(ctx, tc.name, args, db)  # §5.3 always first
            result: dict
            if not decision.allowed:
                denied_reason = denied_reason or decision.reason
                denied_resource = denied_resource or decision.requested_resource
                result = {"error": "access_denied"}
                entry.update(authorization="denied", reason=decision.reason, result_status="denied", result=result)
            else:
                entry.update(authorization="allowed", reason=None)
                key = tg.call_key(tc.name, args)
                if guard_tools and key in seen:
                    result = seen[key]
                    entry.update(result_status="deduplicated", result=result)
                elif guard_tools and tainted:
                    result = {"error": "skipped_after_tool_result_injection"}
                    entry.update(result_status="skipped", result=result)
                    findings.append(Finding("tool", "call_skipped", "medium", f"{tc.name}: request tainted", rule_id="tool_call_skipped", action="block"))
                elif guard_tools and (executed >= tg.MAX_CALLS or per_tool[tc.name] >= tg.MAX_PER_TOOL):
                    result = {"error": "tool_call_limit"}
                    entry.update(result_status="skipped", result=result)
                    findings.append(Finding("tool", "call_limit", "medium", tc.name, rule_id="tool_call_limit", action="block"))
                else:
                    executed += 1
                    per_tool[tc.name] += 1
                    try:
                        result = tg.execute_tool_guarded(ctx, tc.name, args, timeout=guard_tools)
                    except tg.ToolTimeout:
                        entry.update(result_status="timeout", result={"error": "timeout"})
                        tool_log.append(entry)
                        findings.append(Finding("tool", "tool_timeout", "high", tc.name, rule_id="tool_timeout", action="block"))
                        return finish(msg.ERROR, findings, tool_log, raw_log, error=True, tainted=tainted)
                    except Exception as e:  # noqa: BLE001 - tool/DB error (incl. read-only or RLS violations): no details to the model or user
                        result = {"error": "tool_error"}
                        entry.update(result_status="error", result=result)
                        findings.append(Finding("tool", "tool_error", "medium", f"{tc.name}: {type(e).__name__}", rule_id="tool_error"))
                    else:
                        ser = json.dumps({"tool_result": result}, default=str)
                        if guard_tools:
                            ser, capped = tg.cap_size(ser)
                            if capped:
                                result = {"error": "result_too_large"}
                                findings.append(Finding("tool", "result_too_large", "medium", tc.name, rule_id="tool_result_too_large", action="block"))
                            if (hits := tg.scan_result(ser)):
                                tainted = True
                                findings.extend(hits)
                        seen[key] = result
                        verified_ids.update(x.upper() for x in ID_RE.findall(ser))
                        entry.update(result_status="success", result=result)
            tool_log.append(entry)
            payload = result if entry["authorization"] == "denied" else {"tool_result": result}
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": tg.spotlight(json.dumps(payload, default=str), boundary)})
    if final is None:  # iteration cap reached while the model still wanted tools
        final = msg.INCOMPLETE

    auth = "none"
    if tool_log:
        auth = "denied" if denied_reason else "allowed"
    if denied_reason:
        final = msg.CROSS_USER  # forced, whatever the model said

    # §5.4.5 output guardrails
    final, out_findings, out_filter = run_output(db, ctx, final, verified_ids)
    findings.extend(out_findings)
    blocked_by = next((f.rule_id for f in out_findings if f.action == "block"), None)
    return finish(final, findings, tool_log, raw_log, auth, denied_reason, denied_resource, out_filter, blocked=bool(out_filter),
                  blocked_by=blocked_by, tainted=tainted)
