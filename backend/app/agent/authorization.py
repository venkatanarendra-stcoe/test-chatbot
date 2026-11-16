"""Single choke point: every LLM-requested tool call passes authorize_tool_call()."""
import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.agent.context import Principal
from app.agent.tools import TOOLS
from app.guardrails.input_guards import cross_user_resource
from app.guardrails.normalize import build_scan
from app.repositories import claims, customers, policies

_PATTERNS = {"policy_number": re.compile(r"^POL-[A-Z]{2}-\d{6}$"), "claim_number": re.compile(r"^CLM-\d{4}-\d{4}$"),
             "customer_id": re.compile(r"^CUST-\d{4}$")}


@dataclass
class Decision:
    allowed: bool
    reason: str | None = None
    requested_resource: str | None = None


def _type_ok(key: str, spec: dict, value) -> bool:
    if spec.get("type") == "string":
        # identifier arguments are length-checked by their pattern ("invalid argument"); free text by maxLength
        return isinstance(value, str) and (key in _PATTERNS or len(value) <= spec.get("maxLength", 10_000))
    return True


def authorize_tool_call(ctx: Principal, tool_name, args, db: Session | None = None) -> Decision:
    tool = TOOLS.get(tool_name) if isinstance(tool_name, str) else None
    if tool is None:
        return Decision(False, "unknown tool")
    if ctx.role not in tool.roles:
        return Decision(False, "role not permitted")
    if not isinstance(args, dict):
        return Decision(False, "argument tampering")

    props = tool.schema.get("properties", {})
    if [k for k in args if k not in props]:
        # an identity-looking argument that points at someone else is reported as cross-user access
        if db is not None and not ctx.is_admin:
            for v in args.values():
                if isinstance(v, (str, int)) and (ref := cross_user_resource(db, ctx, build_scan(str(v)))):
                    return Decision(False, "cross-user access", ref)
        return Decision(False, "argument tampering")
    if any(k not in args for k in tool.schema.get("required", [])) or any(not _type_ok(k, props[k], v) for k, v in args.items()):
        return Decision(False, "argument tampering")

    for key, rx in _PATTERNS.items():
        if key in args and not rx.match(args[key]):
            return Decision(False, "invalid argument")

    if db is not None:
        if "policy_number" in args:
            owner = policies.owner_of(db, args["policy_number"])
        elif "claim_number" in args:
            owner = claims.owner_of(db, args["claim_number"])
        elif "customer_id" in args:  # admin_get_customer: admins may read any existing customer
            return Decision(True) if customers.exists(db, args["customer_id"]) else Decision(False, "resource not found", args["customer_id"])
        else:
            return Decision(True)
        if owner is None:
            return Decision(False, "resource not found", next(iter(args.values())))
        if owner != ctx.customer_id:  # exists but belongs to another customer
            return Decision(False, "cross-user access", next(iter(args.values())))
    return Decision(True)
