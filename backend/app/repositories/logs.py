"""agent_logs: written by the chat flow (append-only for ia_app); read by the admin console."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import cast, Date, func, select
from sqlalchemy.orm import Session

from app.models.db import AgentLog, Claim, Customer, Policy


def log_to_dict(r: AgentLog, full: bool = True) -> dict:
    d = {
        "request_id": r.request_id, "user": r.username, "query": r.query, "requested_resource": r.requested_resource,
        "tool_calls": r.tool_calls if full else [{k: v for k, v in t.items() if k != "result"} for t in (r.tool_calls or [])],
        "authorization_result": r.authorization_result, "authorization_reason": r.authorization_reason, "output_filter": r.output_filter,
        "guardrail_events": r.guardrail_events, "blocked_by": r.blocked_by, "tainted": r.tainted, "guardrails_degraded": r.guardrails_degraded,
        "llm_provider": r.llm_provider, "llm_model": r.llm_model, "final_response": r.final_response, "created_at": r.created_at.isoformat(),
        "conversation_id": str(r.conversation_id) if r.conversation_id else None, "latency_ms": r.latency_ms,
    }
    if full:
        d.update(id=str(r.id), user_id=str(r.user_id) if r.user_id else None, llm_raw_response=r.llm_raw_response)
    return d


def query_logs(db: Session, user=None, authorization=None, blocked_by=None, date_from=None, date_to=None, page=1, page_size=50) -> dict:
    stmt = select(AgentLog)
    if user:
        stmt = stmt.where(AgentLog.username == user)
    if authorization:
        stmt = stmt.where(AgentLog.authorization_result == authorization)
    if blocked_by:
        stmt = stmt.where(AgentLog.blocked_by == blocked_by)
    if date_from:
        stmt = stmt.where(AgentLog.created_at >= date_from)
    if date_to:
        stmt = stmt.where(AgentLog.created_at <= date_to)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(AgentLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return {"items": [log_to_dict(r) for r in rows], "total": total, "page": page, "page_size": page_size}


def admin_stats(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    day = now - timedelta(hours=24)
    open_claims = ("Submitted", "Documents Pending", "Under Review")
    by_product = db.execute(select(Policy.policy_type, func.count()).group_by(Policy.policy_type).order_by(Policy.policy_type)).all()
    by_status = db.execute(select(Claim.status, func.count()).group_by(Claim.status).order_by(Claim.status)).all()
    week = db.execute(select(cast(AgentLog.created_at, Date), func.count()).where(AgentLog.blocked_by.is_not(None), AgentLog.created_at >= now - timedelta(days=7))
                      .group_by(cast(AgentLog.created_at, Date))).all()
    wk = {d.isoformat(): n for d, n in week}
    top = db.execute(select(AgentLog.blocked_by, func.count().label("n")).where(AgentLog.blocked_by.is_not(None)).group_by(AgentLog.blocked_by)
                     .order_by(func.count().desc()).limit(8)).all()
    return {
        "customers": db.scalar(select(func.count()).select_from(Customer)),
        "active_policies": db.scalar(select(func.count()).select_from(Policy).where(Policy.status.in_(("Active", "Grace Period")))),
        "total_sum_insured": float(db.scalar(select(func.coalesce(func.sum(Policy.sum_insured), 0)).where(Policy.status.in_(("Active", "Grace Period"))))),
        "open_claims": db.scalar(select(func.count()).select_from(Claim).where(Claim.status.in_(open_claims))),
        "chat_requests_24h": db.scalar(select(func.count()).select_from(AgentLog).where(AgentLog.created_at >= day)),
        "blocked_requests_24h": db.scalar(select(func.count()).select_from(AgentLog).where(AgentLog.created_at >= day, AgentLog.blocked_by.is_not(None))),
        "policies_by_product": [{"name": k, "value": v} for k, v in by_product],
        "claims_by_status": [{"name": k, "value": v} for k, v in by_status],
        "blocked_last_7_days": [{"date": (now.date() - timedelta(days=i)).isoformat(),
                                 "value": wk.get((now.date() - timedelta(days=i)).isoformat(), 0)} for i in range(6, -1, -1)],
        "top_guardrail_rules": [{"name": k, "value": v} for k, v in top],
    }
