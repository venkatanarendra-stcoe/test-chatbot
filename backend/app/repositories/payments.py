from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.context import Principal
from app.models.db import Payment
from app.schemas.serializers import payment_dict


def list_for(db: Session, ctx: Principal, mode: str | None = None, status: str | None = None, policy_number: str | None = None) -> list[dict]:
    if not ctx.customer_id:
        return []
    stmt = select(Payment).where(Payment.customer_id == ctx.customer_id).order_by(Payment.paid_on.desc(), Payment.payment_id.desc())
    if mode:
        stmt = stmt.where(Payment.mode == mode)
    if status:
        stmt = stmt.where(Payment.status == status)
    if policy_number:
        stmt = stmt.where(Payment.policy_number == policy_number)
    return [payment_dict(p) for p in db.scalars(stmt)]


def admin_for_customer(db: Session, customer_id: str) -> list[dict]:
    return [payment_dict(p) for p in db.scalars(select(Payment).where(Payment.customer_id == customer_id).order_by(Payment.paid_on.desc()))]
