"""§5.4.5: output guards on every final reply. All checks run; a-d block, e-h redact/adjust."""
import re
from functools import lru_cache

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.context import Principal
from app.agent.prompts import system_prompt
from app.agent.tools import TOOLS
from app.config import get_settings
from app.guardrails import messages as msg
from app.guardrails.input_guards import ID_RE, Finding, known_identifiers, owned_identifiers, patterns, sha_prefix
from app.guardrails.normalize import normalize
from app.models import db as m

_FORBID_ID = re.compile(r"\b(?:POL-[A-Z]{2}-\d{6}|CLM-\d{4}-\d{4}|CUST-\d{4}|PAY-\d{4}-\d{6})\b", re.I)
_IMG = re.compile(r"!\[[^\]]*\]\([^)]*\)")
_LINK = re.compile(r"\[([^\]]*)\]\([^)]*\)")
_HTML = re.compile(r"</?[a-zA-Z!][^>]*>")
_URL = re.compile(r"\b(?:https?://|www\.)\S+", re.I)
_PAN = re.compile(r"FAKE-PAN-(\d{4})")
_AADHAAR = re.compile(r"(?<![\d-])(?<!\d )[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?![\d-])(?! \d)")
_LABELS = {"system_prompt": "system_prompt_leak", "cross_user": "cross_user_leak", "sensitive": "sensitive_info", "unverified": "unverified_identifier"}


def _prompt_lines() -> list[str]:
    out = []
    for line in system_prompt().splitlines():
        body = normalize(re.sub(r"^\d+\.\s*", "", line))
        if len(body) > 40:
            out.append(body)
    return out


def _secret_values() -> list[str]:
    s = get_settings()
    vals = [s.jwt_secret, s.openai_api_key, s.system_prompt_canary]
    for url in (s.database_url, s.tools_database_url, s.migrations_database_url, s.test_database_url):
        try:
            from sqlalchemy.engine import make_url

            u = make_url(url)
            vals += [u.password or "", url]
        except Exception:  # noqa: BLE001
            pass
    return [v for v in vals if v and len(v) >= 6]


def _protected_names(db: Session, ctx: Principal) -> set[str]:
    """Names (customers, nominees, family members) belonging to OTHER customers and not to the caller."""
    def names_of(cid: str | None) -> set[str]:
        out: set[str] = set()
        for c in db.scalars(select(m.Customer).where(m.Customer.customer_id == cid)):
            out.add(c.full_name)
        for p in db.scalars(select(m.Policy).where(m.Policy.customer_id == cid)):
            if p.nominee and "." not in p.nominee:
                out.add(p.nominee)
            out.update(x["name"] for x in (p.details or {}).get("members", []) if x.get("name"))
        return {n.lower() for n in out}

    own = names_of(ctx.customer_id) if ctx.customer_id else set()
    everyone: set[str] = set()
    for cid in db.scalars(select(m.Customer.customer_id)):
        everyone |= names_of(cid)
    return everyone - own


def _other_customers_leak(db: Session, ctx: Principal, reply: str) -> str | None:
    owned = owned_identifiers(db, ctx)
    known = known_identifiers(db)
    for mt in ID_RE.finditer(reply):
        v = mt.group(1).upper()
        if v in known and v not in owned:  # an unknown ID (POL-HL-999999) is "unverified", not a leak
            return v
    low = normalize(reply)
    for name in _protected_names(db, ctx):
        if re.search(rf"\b{re.escape(name)}\b", low):
            return name
    for c in db.scalars(select(m.Customer)):
        if c.customer_id == ctx.customer_id:
            continue
        if c.email.lower() in low:
            return c.email.lower()
        digits = re.sub(r"\D", "", c.phone)
        if re.search(rf"{digits[-10:-5]}[\s.\-]?{digits[-5:]}", low):
            return c.phone
    return None


def run_output_guards(db: Session, ctx: Principal, reply: str, verified_ids: set[str]) -> tuple[str, list[Finding], str | None]:
    """Returns (final_reply, findings, output_filter_label_of_the_winning_block)."""
    findings: list[Finding] = []
    blocks: dict[str, str] = {}
    low = normalize(reply)
    p = patterns()
    s = get_settings()

    # a. system prompt leak
    if s.system_prompt_canary.lower() in low or any(line in low for line in _prompt_lines()) or "<<tool_result" in low or "<<end_tool_result" in low:
        findings.append(Finding("output", "system_prompt", "high", "prompt/canary/boundary text in reply", rule_id="output_system_prompt_leak", action="block"))
        blocks["system_prompt"] = msg.SYSTEM_PROMPT
    # b. cross-user leak (customers only)
    if not ctx.is_admin and (res := _other_customers_leak(db, ctx, reply)):
        findings.append(Finding("output", "cross_user", "high", "other customer data in reply", res, rule_id="output_cross_user_leak", action="block"))
        blocks["cross_user"] = msg.CROSS_USER
    # c. secrets (never log the value: rule + hash prefix only)
    secret = next(((r["id"], r["_re"].search(reply).group(0)) for r in p["secrets"] if r["_re"].search(reply)), None) or next(
        (("secret_value", v) for v in _secret_values() if v.lower() in reply.lower()), None)
    if secret:
        findings.append(Finding("output", "sensitive", "high", f"{secret[0]} {sha_prefix(secret[1])}", rule_id="output_secret", action="block"))
        blocks["sensitive"] = msg.SENSITIVE
    # d. internal details (customers only)
    if not ctx.is_admin:
        internal = next((r["id"] for r in p["internal_details"] if r["_re"].search(reply)), None) or next(
            ("tool_name" for t in TOOLS if re.search(rf"\b{re.escape(t)}\b", reply, re.I)), None) or (
            "model_name" if s.llm_model and len(s.llm_model) >= 4 and s.llm_model.lower() in low else None)
        if internal:
            findings.append(Finding("output", "sensitive", "high", internal, rule_id="output_internal_detail", action="block"))
            blocks["sensitive"] = msg.SENSITIVE
    # g. unverified identifiers
    unverified = sorted({x.upper() for x in _FORBID_ID.findall(reply)} - verified_ids)
    if unverified:
        findings.append(Finding("output", "unverified", "medium", ",".join(unverified), rule_id="output_unverified_id", action="block"))
        blocks["unverified"] = msg.UNVERIFIED

    for key, text in (("system_prompt", msg.SYSTEM_PROMPT), ("cross_user", msg.CROSS_USER), ("sensitive", msg.SENSITIVE), ("unverified", msg.UNVERIFIED)):
        if key in blocks:
            return text, findings, f"output_filter: {_LABELS[key]}"

    # e. unmasked PAN / Aadhaar-like numbers
    if _PAN.search(reply) or _AADHAAR.search(reply):
        reply = _AADHAAR.sub("[REDACTED]", _PAN.sub(lambda mt: "******" + mt.group(1), reply))
        findings.append(Finding("output", "redact", "info", "PAN/Aadhaar-like value masked", rule_id="output_pan", action="redact"))
    # f. exfiltration channels: images, html, links (keep link text)
    stripped = _URL.sub("", _HTML.sub("", _LINK.sub(r"\1", _IMG.sub("", reply))))
    if stripped != reply:
        findings.append(Finding("output", "redact", "info", "images/html/links stripped", rule_id="output_markup", action="redact"))
        reply = stripped.strip()
    # h. length
    if len(reply) > s.max_reply_chars:
        reply = reply[:s.max_reply_chars].rstrip() + "…"
        findings.append(Finding("output", "truncate", "info", f"limit {s.max_reply_chars}", rule_id="output_truncate", action="redact"))
    return reply, findings, None
