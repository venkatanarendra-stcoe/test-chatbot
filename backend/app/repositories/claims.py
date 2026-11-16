from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.agent.context import Principal
from app.models.db import Claim
from app.schemas.serializers import claim_dict


def list_for(db: Session, ctx: Principal, status: str | None = None, policy_number: str | None = None) -> list[dict]:
    if not ctx.customer_id:
        return []
    stmt = select(Claim).where(Claim.customer_id == ctx.customer_id).order_by(Claim.filed_date.desc(), Claim.claim_number.desc())
    if status:
        stmt = stmt.where(Claim.status == status)
    if policy_number:
        stmt = stmt.where(Claim.policy_number == policy_number)
    return [claim_dict(c) for c in db.scalars(stmt)]


def get_for(db: Session, ctx: Principal, claim_number: str) -> dict | None:
    c = db.scalar(select(Claim).where(Claim.claim_number == claim_number, Claim.customer_id == ctx.customer_id))
    return claim_dict(c) if c else None


def owner_of(db: Session, claim_number: str) -> str | None:
    return db.scalar(select(Claim.customer_id).where(Claim.claim_number == claim_number))


def admin_page(db: Session, q, status, page, page_size) -> dict:
    stmt = select(Claim)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Claim.claim_number).like(like), func.lower(Claim.customer_id).like(like), func.lower(Claim.claim_type).like(like)))
    if status:
        stmt = stmt.where(Claim.status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Claim.filed_date.desc(), Claim.claim_number.desc()).offset((page - 1) * page_size).limit(page_size))
    return {"items": [claim_dict(c) for c in rows], "total": total, "page": page, "page_size": page_size}


def admin_for_customer(db: Session, customer_id: str) -> list[dict]:
    return [claim_dict(c) for c in db.scalars(select(Claim).where(Claim.customer_id == customer_id).order_by(Claim.claim_number))]
