"""Tool registry and executors. Tools are read-only and run as the `ia_tools` DB role inside BEGIN READ ONLY with
row-level security: the RLS context (app.customer_id / app.is_admin) comes from the trusted ctx, never from LLM arguments.
Customer tool functions have no customer/user id parameter."""
from dataclasses import dataclass
from typing import Callable

from sqlalchemy import Column, Date, DateTime, MetaData, String, Table, select, text
from sqlalchemy.orm import Session

from app.agent.context import Principal
from app.config import get_settings
from app.db.engines import tools_engine
from app.models.db import Claim, Payment, Policy
from app.schemas.serializers import claim_dict, payment_dict, policy_dict, profile_dict
from app.services import knowledge

NO_ARGS = {"type": "object", "properties": {}, "additionalProperties": False}
NO_POLICY = "No policy is associated with this account."

# ia_tools has no privilege on customers.pan: tools read the masked view
_md = MetaData()
CustomersMasked = Table(
    "customers_masked", _md, Column("customer_id", String), Column("full_name", String), Column("email", String), Column("phone", String),
    Column("date_of_birth", Date), Column("city", String), Column("state", String), Column("pan_masked", String),
    Column("account_reference", String), Column("created_at", DateTime(timezone=True)),
)


@dataclass(frozen=True)
class ToolDef:
    name: str
    description: str
    schema: dict
    roles: frozenset
    fn: Callable[[Session, Principal, dict], dict]


def _profile_row(s: Session, customer_id: str | None):
    return s.execute(select(CustomersMasked).where(CustomersMasked.c.customer_id == customer_id)).first() if customer_id else None


def _get_my_policy(s, ctx, a):
    if not ctx.customer_id:
        return {"message": NO_POLICY}
    rows = s.scalars(select(Policy).where(Policy.customer_id == ctx.customer_id).order_by(Policy.policy_number)).all()
    return {"policies": [policy_dict(p) for p in rows]} if rows else {"message": NO_POLICY}


def _get_my_policy_details(s, ctx, a):
    p = s.scalar(select(Policy).where(Policy.policy_number == a["policy_number"], Policy.customer_id == ctx.customer_id))
    return {"policy": policy_dict(p, full=True)} if p else {"error": "not_found"}


def _get_my_claims(s, ctx, a):
    if not ctx.customer_id:
        return {"message": NO_POLICY}
    rows = s.scalars(select(Claim).where(Claim.customer_id == ctx.customer_id).order_by(Claim.filed_date.desc(), Claim.claim_number.desc())).all()
    return {"claims": [claim_dict(c) for c in rows]}


def _get_my_claim_status(s, ctx, a):
    c = s.scalar(select(Claim).where(Claim.claim_number == a["claim_number"], Claim.customer_id == ctx.customer_id))
    return {"claim": claim_dict(c)} if c else {"error": "not_found"}


def _get_my_payments(s, ctx, a):
    if not ctx.customer_id:
        return {"message": NO_POLICY}
    rows = s.scalars(select(Payment).where(Payment.customer_id == ctx.customer_id).order_by(Payment.paid_on.desc(), Payment.payment_id.desc())).all()
    return {"payments": [payment_dict(p) for p in rows]}


def _get_user_profile(s, ctx, a):
    row = _profile_row(s, ctx.customer_id)
    return {"profile": profile_dict(row)} if row else {"profile": {"username": ctx.username, "role": ctx.role}}


def _get_claim_information(s, ctx, a):
    return knowledge.claim_information(a.get("product"))


def _search_faq(s, ctx, a):
    return {"results": knowledge.search_faq(a["query"])}


def _admin_list_customers(s, ctx, a):
    rows = s.execute(select(CustomersMasked).order_by(CustomersMasked.c.customer_id)).all()
    return {"customers": [profile_dict(r) for r in rows]}


def _admin_get_customer(s, ctx, a):
    cid = a["customer_id"]
    row = _profile_row(s, cid)
    if row is None:
        return {"error": "not_found"}
    return {"profile": profile_dict(row),
            "policies": [policy_dict(p, full=True) for p in s.scalars(select(Policy).where(Policy.customer_id == cid).order_by(Policy.policy_number))],
            "claims": [claim_dict(c) for c in s.scalars(select(Claim).where(Claim.customer_id == cid).order_by(Claim.claim_number))],
            "payments": [payment_dict(p) for p in s.scalars(select(Payment).where(Payment.customer_id == cid).order_by(Payment.payment_id))]}


def _obj(**props):
    return {"type": "object", "properties": props, "required": [k for k, v in props.items() if v.pop("_required", False)], "additionalProperties": False}


_BOTH, _ADMIN = frozenset({"customer", "admin"}), frozenset({"admin"})
TOOLS: dict[str, ToolDef] = {t.name: t for t in [
    ToolDef("get_my_policy", "Get a summary of all insurance policies of the authenticated user.", NO_ARGS, _BOTH, _get_my_policy),
    ToolDef("get_my_policy_details", "Get the full details of ONE policy owned by the authenticated user.",
            _obj(policy_number={"type": "string", "maxLength": 20, "description": "e.g. POL-HL-100001", "_required": True}), _BOTH, _get_my_policy_details),
    ToolDef("get_my_claims", "Get all claims of the authenticated user.", NO_ARGS, _BOTH, _get_my_claims),
    ToolDef("get_my_claim_status", "Get the status of ONE claim owned by the authenticated user.",
            _obj(claim_number={"type": "string", "maxLength": 20, "description": "e.g. CLM-2026-0001", "_required": True}), _BOTH, _get_my_claim_status),
    ToolDef("get_my_payments", "Get the premium payments of the authenticated user.", NO_ARGS, _BOTH, _get_my_payments),
    ToolDef("get_user_profile", "Get the authenticated user's profile (PAN is masked).", NO_ARGS, _BOTH, _get_user_profile),
    ToolDef("get_claim_information", "General steps and required documents for filing a claim.",
            _obj(product={"type": "string", "maxLength": 40, "description": "health, life, motor, home or travel"}), _BOTH, _get_claim_information),
    ToolDef("search_insurance_faq", "Keyword search over the general insurance FAQ (top 3 results).",
            _obj(query={"type": "string", "maxLength": 300, "_required": True}), _BOTH, _search_faq),
    ToolDef("admin_list_customers", "(Admin) List all customers.", NO_ARGS, _ADMIN, _admin_list_customers),
    ToolDef("admin_get_customer", "(Admin) Get a customer's profile, policies, claims and payments.",
            _obj(customer_id={"type": "string", "maxLength": 16, "description": "e.g. CUST-1001", "_required": True}), _ADMIN, _admin_get_customer),
]}


def schemas_for_role(role: str) -> list[dict]:
    """OpenAI/Ollama-style tool schemas visible to a role (defense in depth; authorization still re-checks)."""
    return [{"type": "function", "function": {"name": t.name, "description": t.description, "parameters": t.schema}}
            for t in TOOLS.values() if role in t.roles]


def execute_tool(ctx: Principal, name: str, args: dict) -> dict:
    """One transaction per call: BEGIN READ ONLY; set the RLS context from ctx; run; end."""
    t = max(1, int(get_settings().tool_timeout_seconds * 1000))
    with Session(tools_engine()) as s:  # engine opens every connection READ ONLY
        s.execute(text("SELECT set_config('app.customer_id', :c, true), set_config('app.is_admin', :a, true), set_config('statement_timeout', :t, true)"),
                  {"c": ctx.customer_id or "", "a": "true" if ctx.is_admin else "false", "t": str(t)})
        try:
            return TOOLS[name].fn(s, ctx, args)
        finally:
            s.rollback()
