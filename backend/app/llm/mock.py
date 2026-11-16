"""Rule-based mock provider: keywords -> tool calls, templates -> replies (uses the preformatted INR strings from tool results)."""
import json
import re
import uuid
from datetime import date

from app.guardrails import messages as msg
from app.llm.base import LLMError, LLMProvider, LLMResponse, ToolCall

_PERSONAL = re.compile(r"\b(my|mine|me)\b|^\s*(show|list|view|display|get|check)\b", re.I)
_POL = re.compile(r"pol-[a-z]{2}-\d{6}", re.I)
_CLM = re.compile(r"clm-\d{4}-\d{4}", re.I)
_CUST = re.compile(r"cust-?\d{4}", re.I)


def _join(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def _table(headers: list[str], rows: list[list[str]]) -> str:
    out = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
    out += ["| " + " | ".join(str(c).replace("|", "/") for c in r) + " |" for r in rows]
    return "\n".join(out)


def plan(query: str) -> tuple[str, list[tuple[str, dict]]]:
    """Maps a user message to (intent, [(tool, args)])."""
    q = query.lower()
    if re.search(r"system (prompt|instruction|message)|your (instructions|prompt)|canary|initial prompt", q):
        return "prompt", []
    if (m := _CUST.search(q)):
        cid = m.group(0).upper()
        return "admin_get", [("admin_get_customer", {"customer_id": cid if "-" in cid else cid[:4] + "-" + cid[4:]})]
    if re.search(r"\bcustomers\b", q) and not re.search(r"\bmy\b", q):
        return "admin_list", [("admin_list_customers", {})]
    personal = bool(_PERSONAL.search(q))
    ptype = next((t for t in ("health", "life", "motor", "home", "travel") if t in q), None)
    if (m := _CLM.search(q)):
        return "claim_status", [("get_my_claim_status", {"claim_number": m.group(0).upper()})]
    if (m := _POL.search(q)) and re.search(r"detail|cover|explain|nominee|member|include|about|describe", q):
        return "policy_details", [("get_my_policy_details", {"policy_number": m.group(0).upper()})]
    if personal and re.search(r"\b(payments?|paid|transactions?|premiums? paid)\b", q):
        return "payments", [("get_my_payments", {})]
    if re.search(r"\bclaims?\b", q):
        if re.search(r"\b(file|filing|submit|steps?|documents?|required|process for)\b", q) and not re.search(r"\bmy claims?\b", q):
            return "claim_info", [("get_claim_information", {"product": ptype} if ptype else {})]
        if personal:
            return "claims", [("get_my_claims", {})]
    if personal and re.search(r"\bgrace\b", q):
        return "policy_grace", [("get_my_policy", {})]
    if personal and re.search(r"\brenew", q):
        return "policy_renewal", [("get_my_policy", {})]
    if personal and re.search(r"\b(policy|policies|coverage|covered|sum insured|premium|deductible|nominee|beneficiary|plan|insurance)\b", q):
        for key, pat in (("number", r"number"), ("coverage", r"coverage|sum insured|idv"), ("status", r"status"), ("premium", r"premium"),
                         ("deductible", r"deductible"), ("nominee", r"nominee|beneficiary")):
            if re.search(pat, q):
                return "policy_" + key, [("get_my_policy", {})]
        return "policy_list", [("get_my_policy", {})]
    if (personal and re.search(r"\b(profile|email|phone|city|birth|dob|pan|details|account|name|address)\b", q)) or "who am i" in q:
        return "profile", [("get_user_profile", {})]
    return "faq", [("search_insurance_faq", {"query": query})]


def _detail_lines(det: dict) -> list[str]:
    lines = []
    for k, v in det.items():
        label = k.replace("_", " ").capitalize()
        if k == "members":
            v = ", ".join(f'{x.get("name", x["relation"].capitalize())} ({x["relation"]})' for x in v)
        elif isinstance(v, list):
            v = ", ".join(map(str, v))
        elif isinstance(v, bool):
            v = "Yes" if v else "No"
        lines.append(f"- **{label}:** {v}")
    return lines


def render(intent: str, results: list[dict]) -> str:
    r = results[0] if results else {}
    if "message" in r:
        return r["message"]
    if "error" in r:
        return "I couldn't find that record."
    if intent.startswith("policy_") and intent not in ("policy_details",):
        pols = r.get("policies", [])
        key = intent[7:]
        if key == "list":
            rows = [[p["policy_number"], p["product"], p["status"], p["sum_insured_display"], p["annual_premium_display"], f'{p["start_date_display"]} to {p["end_date_display"]}']
                    for p in pols]
            return "Here are your policies:\n\n" + _table(["Policy", "Product", "Status", "Sum insured", "Annual premium", "Period"], rows)
        if key == "grace":
            g = [p for p in pols if p["status"] == "Grace Period"]
            if not g:
                return "None of your policies is in a grace period."
            return "\n".join(f'Yes, {p["policy_number"]} ({p["product"]}) is in its grace period. Renew by {p.get("grace_until_display") or p["end_date_display"]}.' for p in g)
        if key == "renewal":
            today = date.today().isoformat()
            up = sorted((p for p in pols if p["status"] in ("Active", "Grace Period") and p["end_date"] >= today), key=lambda p: p["end_date"])
            return (f'Your next renewal is {up[0]["policy_number"]} on {up[0]["end_date_display"]}.' if up else "You have no upcoming renewals.")
        label, getter = {
            "number": ("policy number", lambda p: p["policy_number"]), "coverage": ("sum insured", lambda p: p["sum_insured_display"]),
            "status": ("policy status", lambda p: p["status"]), "premium": ("annual premium", lambda p: p["annual_premium_display"]),
            "deductible": ("deductible", lambda p: p["deductible_display"]), "nominee": ("nominee", lambda p: p["nominee"] or "not on file"),
        }[key]
        if len(pols) == 1:
            return f"Your {label} is {getter(pols[0])}."
        if key == "number":
            return f"Your policy numbers are {_join([p['policy_number'] for p in pols])}."
        return f"Your {label} by policy:\n\n" + "\n".join(f"- {p['policy_number']} ({p['product']}): {getter(p)}" for p in pols)
    if intent == "policy_details":
        p = r["policy"]
        head = [f"**{p['policy_number']}** · {p['product']} · {p['status']}", f"- **Sum insured:** {p['sum_insured_display']}",
                f"- **Annual premium:** {p['annual_premium_display']}", f"- **Deductible:** {p['deductible_display']}",
                f"- **Validity:** {p['start_date_display']} to {p['end_date_display']}"]
        if p.get("nominee"):
            head.append(f"- **Nominee:** {p['nominee']}")
        return "\n".join(head + _detail_lines(p.get("details") or {}))
    if intent == "claims":
        cl = r.get("claims", [])
        if not cl:
            return "You have no claims on file."
        return "Here are your claims:\n\n" + _table(["Claim", "Policy", "Type", "Amount", "Status", "Filed"],
                                                   [[c["claim_number"], c["policy_number"], c["claim_type"], c["amount_display"], c["status"], c["filed_date_display"]] for c in cl])
    if intent == "claim_status":
        c = r["claim"]
        return f'Claim {c["claim_number"]} ({c["claim_type"]}) for {c["amount_display"]} on {c["policy_number"]} is **{c["status"]}**. It was filed on {c["filed_date_display"]}.'
    if intent == "payments":
        pay = r.get("payments", [])
        if not pay:
            return "You have no premium payments on record."
        return "Here are your premium payments:\n\n" + _table(["Payment", "Policy", "Amount", "Date", "Mode", "Status"],
                                                             [[x["payment_id"], x["policy_number"], x["amount_display"], x["paid_on_display"], x["mode"], x["status"]] for x in pay])
    if intent == "profile":
        p = r["profile"]
        if "full_name" not in p:
            return f"You are signed in as {p['username']} ({p['role']})."
        return (f"Here is your profile:\n\n- **Name:** {p['full_name']}\n- **Email:** {p['email']}\n- **Phone:** {p['phone']}\n"
                f"- **Date of birth:** {p['date_of_birth_display']}\n- **City:** {p['city']}, {p['state']}\n- **PAN:** {p['pan_masked']}\n"
                f"- **Account reference:** {p['account_reference']}")
    if intent == "claim_info":
        out = "To file a claim:\n\n" + "\n".join(f"{i}. {s}" for i, s in enumerate(r["steps"], 1))
        for t, docs in r["required_documents"].items():
            out += f"\n\n**Documents for {t} insurance:**\n" + "\n".join(f"- {d}" for d in docs)
        return out
    if intent == "admin_list":
        return "Customers:\n\n" + _table(["ID", "Name", "Email", "City"], [[c["customer_id"], c["full_name"], c["email"], c["city"]] for c in r["customers"]])
    if intent == "admin_get":
        p = r["profile"]
        return (f"**{p['full_name']}** ({p['customer_id']}), {p['email']}, {p['city']}\n\nPolicies: "
                + (_join([x["policy_number"] for x in r["policies"]]) if r["policies"] else "none")
                + "\n\nClaims: " + (_join([x["claim_number"] for x in r["claims"]]) if r["claims"] else "none"))
    res = r.get("results", [])
    if res:
        return res[0]["answer"]
    return "I couldn't find that in my insurance FAQ. I can help with your policies, claims, payments, and general insurance questions."


def _payload(content: str) -> dict:
    """Tool messages are wrapped in <<TOOL_RESULT ...>> boundaries around {"tool_result": ...} JSON."""
    mt = re.search(r"\{.*\}", content, re.S)
    try:
        d = json.loads(mt.group(0)) if mt else {}
    except json.JSONDecodeError:
        return {}
    return d.get("tool_result", d)


class MockLLM(LLMProvider):
    name = "mock"
    model = "mock"
    # Test hooks (class-level so tests can set them without touching the provider instance).
    next_tool_calls: list[dict] | None = None   # [{"tool":..., "arguments":{...}}], used on the next fresh user turn
    repeat_tool_calls: bool = False             # keep returning next_tool_calls on every call (tests the iteration cap)
    next_reply: str | None = None               # force the next raw LLM output
    raise_error: bool = False                   # simulate a provider failure on every call
    obey_tool_injection: bool = False           # simulate a gullible model that follows instructions in tool results
    classifier_result: dict | None = None

    @classmethod
    def reset(cls):
        cls.next_tool_calls, cls.repeat_tool_calls, cls.next_reply = None, False, None
        cls.raise_error, cls.obey_tool_injection, cls.classifier_result = False, False, None

    def classify(self, message):
        return type(self).classifier_result

    def chat(self, messages, tools):
        cls = type(self)
        if cls.raise_error:
            raise LLMError("MockProviderError")
        last_user = max(i for i, m in enumerate(messages) if m["role"] == "user")
        query = messages[last_user]["content"]
        after = messages[last_user + 1:]
        tool_msgs = [m for m in after if m["role"] == "tool"]

        if cls.next_tool_calls is not None and (not tool_msgs or cls.repeat_tool_calls):
            calls = cls.next_tool_calls
            if not cls.repeat_tool_calls:
                cls.next_tool_calls = None
            return self._calls([(c["tool"], c.get("arguments", {})) for c in calls], "hook")
        if cls.next_reply is not None:
            text, cls.next_reply = cls.next_reply, None
            return LLMResponse(text, [], {"provider": "mock", "rule": "next_reply"})

        intent, wanted = plan(query)
        if not tool_msgs:
            if intent == "prompt":
                return LLMResponse(msg.SYSTEM_PROMPT, [], {"provider": "mock", "rule": "prompt_request"})
            return self._calls(wanted, intent)
        called = [tc["function"]["name"] for m in after if m["role"] == "assistant" for tc in m.get("tool_calls", [])]
        if cls.obey_tool_injection and any("admin_list_customers" in m["content"] for m in tool_msgs) and "admin_list_customers" not in called:
            return self._calls([("admin_list_customers", {})], "obeyed_injection")
        if any("access_denied" in m["content"] for m in tool_msgs):
            return LLMResponse(msg.CROSS_USER, [], {"provider": "mock", "rule": "denied"})
        return LLMResponse(render(intent, [_payload(m["content"]) for m in tool_msgs]), [], {"provider": "mock", "rule": intent})

    @staticmethod
    def _calls(pairs, rule):
        calls = [ToolCall("call_" + uuid.uuid4().hex[:12], n, a) for n, a in pairs]
        return LLMResponse(None, calls, {"provider": "mock", "rule": rule, "tool_calls": [{"tool": n, "arguments": a} for n, a in pairs]})
