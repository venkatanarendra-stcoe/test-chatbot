from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import Principal, require_admin
from app.config import get_settings
from app.db.engines import get_db
from app.guardrails.rate_limit import limiter
from app.llm import get_llm
from app.models.db import User
from app.repositories import claims, customers, logs, payments, policies

router = APIRouter(prefix="/api/admin")
PAGE = Query(1, ge=1)
SIZE = Query(25, ge=1, le=200)


@router.get("/stats")
def stats(_: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    return logs.admin_stats(db)


@router.get("/customers")
def list_customers(q: str | None = Query(None, max_length=64), page: int = PAGE, page_size: int = SIZE, sort: str | None = Query(None, max_length=24),
                   _: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    return customers.admin_page(db, q, page, page_size, sort)


@router.get("/customers/{customer_id}")
def customer(customer_id: str, _: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    prof = customers.admin_get(db, customer_id)
    if prof is None:
        raise HTTPException(404, "Customer not found")
    username = db.scalar(select(User.username).where(User.customer_id == customer_id))
    return {"profile": prof, "username": username, "policies": policies.admin_for_customer(db, customer_id), "claims": claims.admin_for_customer(db, customer_id),
            "payments": payments.admin_for_customer(db, customer_id)}


@router.get("/policies")
def list_policies(q: str | None = Query(None, max_length=64), status: str | None = Query(None, max_length=24), type: str | None = Query(None, max_length=16),
                  page: int = PAGE, page_size: int = SIZE, _: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    return policies.admin_page(db, q, status, type, page, page_size)


@router.get("/claims")
def list_claims(q: str | None = Query(None, max_length=64), status: str | None = Query(None, max_length=24), page: int = PAGE, page_size: int = SIZE,
                _: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    return claims.admin_page(db, q, status, page, page_size)


@router.get("/logs")
def list_logs(user: str | None = Query(None, max_length=64), authorization: str | None = Query(None, pattern="^(allowed|denied|none)$"),
              blocked_by: str | None = Query(None, max_length=64), date_from: datetime | None = Query(None, alias="from"), date_to: datetime | None = Query(None, alias="to"),
              page: int = PAGE, page_size: int = SIZE, _: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    return logs.query_logs(db, user, authorization, blocked_by, date_from, date_to, page, page_size)


@router.get("/lockouts")
def list_lockouts(_: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    active = limiter.active()
    users = {str(u.id): u.username for u in db.scalars(select(User).where(User.id.in_([k for k in active if k])))} if active else {}
    return [{"username": users.get(k, "unknown"), "seconds_left": s} for k, s in active.items()]


@router.delete("/lockouts/{username}")
def clear_lockout(username: str, _: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        raise HTTPException(404, "User not found")
    limiter.clear(str(user.id))
    return {"status": "cleared", "username": username}


@router.get("/system")
def system(_: Principal = Depends(require_admin)):
    s = get_settings()
    llm = get_llm()
    return {"llm_provider": s.llm_provider, "llm_model": s.llm_model, "llm": llm.status(),
            "guardrails": {"input": s.guardrails_input, "tool": s.guardrails_tool, "output": s.guardrails_output,
                           "llm_classifier": s.guardrail_llm_classifier, "degraded": s.guardrails_degraded},
            "rate_limit_per_minute": s.rate_limit_per_minute, "lockout_enabled": s.lockout_enabled}
