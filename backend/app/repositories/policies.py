import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.agent.context import Principal
from app.models.db import Payment, Policy
from app.schemas.serializers import payment_dict, policy_dict


def list_for(db: Session, ctx: Principal, status: str | None = None, policy_type: str | None = None, q: str | None = None) -> list[dict]:
    if not ctx.customer_id:
        return []
    stmt = select(Policy).where(Policy.customer_id == ctx.customer_id).order_by(Policy.policy_number)
    if status:
        stmt = stmt.where(Policy.status == status)
    if policy_type:
        stmt = stmt.where(Policy.policy_type == policy_type)
    if q:
        stmt = stmt.where(or_(func.lower(Policy.policy_number).like(f"%{q.lower()}%"), func.lower(Policy.product).like(f"%{q.lower()}%")))
    return [policy_dict(p) for p in db.scalars(stmt)]


def get_for(db: Session, ctx: Principal, policy_number: str) -> dict | None:
    """None for both 'not found' and 'not yours' (identical to the caller)."""
    p = db.scalar(select(Policy).where(Policy.policy_number == policy_number, Policy.customer_id == ctx.customer_id))
    return policy_dict(p, full=True) if p else None


def owner_of(db: Session, policy_number: str) -> str | None:
    """Used only by the authorization layer to tell 'not owned' from 'not found' in the audit log."""
    return db.scalar(select(Policy.customer_id).where(Policy.policy_number == policy_number))


def admin_page(db: Session, q, status, policy_type, page, page_size) -> dict:
    stmt = select(Policy)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Policy.policy_number).like(like), func.lower(Policy.customer_id).like(like), func.lower(Policy.product).like(like)))
    if status:
        stmt = stmt.where(Policy.status == status)
    if policy_type:
        stmt = stmt.where(Policy.policy_type == policy_type)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Policy.policy_number).offset((page - 1) * page_size).limit(page_size))
    return {"items": [policy_dict(p) for p in rows], "total": total, "page": page, "page_size": page_size}


def admin_for_customer(db: Session, customer_id: str) -> list[dict]:
    return [policy_dict(p, full=True) for p in db.scalars(select(Policy).where(Policy.customer_id == customer_id).order_by(Policy.policy_number))]


RENEWABLE = ("Active", "Grace Period", "Lapsed")
PAYMENT_MODES = ("UPI", "Net Banking", "Credit Card", "Auto-debit")


class NotRenewable(Exception):
    pass


def _plus_year(d: date) -> date:
    try:
        return d.replace(year=d.year + 1)
    except ValueError:  # 29 Feb
        return d.replace(year=d.year + 1, day=28)


def renew(db: Session, ctx: Principal, policy_number: str, mode: str = "UPI") -> tuple[dict, dict] | None:
    """Extend an own policy by one year and record the premium payment. None when not found / not owned."""
    p = db.scalar(select(Policy).where(Policy.policy_number == policy_number, Policy.customer_id == ctx.customer_id).with_for_update())
    if p is None:
        return None
    if p.status not in RENEWABLE:
        raise NotRenewable(p.status)
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    p.end_date = _plus_year(max(p.end_date, today))
    p.status = "Active"
    p.details = {k: v for k, v in (p.details or {}).items() if k != "grace_until"}
    pay = Payment(id=uuid.uuid4(), payment_id=f"PAY-R-{uuid.uuid4().hex[:12]}", customer_id=p.customer_id, policy_number=p.policy_number,
                  amount=p.annual_premium, paid_on=today, mode=mode, status="Success")
    db.add(pay)
    db.commit()
    return policy_dict(p, full=True), payment_dict(pay)
