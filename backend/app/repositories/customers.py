"""Customer data access. Customer-facing functions take the trusted ctx and use ctx.customer_id only."""
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import Session

from app.agent.context import Principal
from app.models.db import Customer
from app.schemas.serializers import profile_dict

CONTACT_FIELDS = ("phone", "email", "city", "state")
_SORTABLE = {"customer_id": Customer.customer_id, "full_name": Customer.full_name, "city": Customer.city, "created_at": Customer.created_at}


def get_profile(db: Session, ctx: Principal) -> dict | None:
    c = db.get(Customer, ctx.customer_id) if ctx.customer_id else None
    return profile_dict(c) if c else None


def update_contact(db: Session, ctx: Principal, fields: dict) -> dict | None:
    c = db.get(Customer, ctx.customer_id) if ctx.customer_id else None
    if c is None:
        return None
    for k, v in fields.items():
        if k in CONTACT_FIELDS:  # defense in depth; ia_app also lacks UPDATE on the other columns
            setattr(c, k, v)
    db.commit()
    return profile_dict(c)


def exists(db: Session, customer_id: str) -> bool:
    return db.get(Customer, customer_id) is not None


# ---- admin (callers must hold the admin dependency)
def admin_page(db: Session, q: str | None, page: int, page_size: int, sort: str | None) -> dict:
    stmt = select(Customer)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Customer.full_name).like(like), func.lower(Customer.email).like(like),
                              func.lower(Customer.customer_id).like(like), func.lower(Customer.city).like(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    col = _SORTABLE.get((sort or "customer_id").lstrip("-"), Customer.customer_id)
    stmt = stmt.order_by(desc(col) if (sort or "").startswith("-") else asc(col)).offset((page - 1) * page_size).limit(page_size)
    return {"items": [profile_dict(c) for c in db.scalars(stmt)], "total": total, "page": page, "page_size": page_size}


def admin_get(db: Session, customer_id: str) -> dict | None:
    c = db.get(Customer, customer_id)
    return profile_dict(c) if c else None
