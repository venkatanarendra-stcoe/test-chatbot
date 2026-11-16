import re
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import Principal, get_current_user
from app.db.engines import get_db
from app.repositories import customers
from app.services.logging import write_agent_log

router = APIRouter(prefix="/api")
_PHONE = re.compile(r"^\+91[ -]?\d{5}[ -]?\d{5}$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _me(db: Session, p: Principal) -> dict:
    prof = customers.get_profile(db, p)
    return {"username": p.username, "role": p.role, "name": prof["full_name"] if prof else "Platform Admin", "profile": prof}


@router.get("/me")
def get_me(p: Principal = Depends(get_current_user), db: Session = Depends(get_db)):
    return _me(db, p)


@router.patch("/me")
def patch_me(body: dict = Body(...), p: Principal = Depends(get_current_user), db: Session = Depends(get_db)):
    forbidden = [k for k in body if k not in customers.CONTACT_FIELDS]
    if forbidden:
        write_agent_log(db, request_id=str(uuid.uuid4()), user_id=p.user_id, username=p.username, query=f"PATCH /api/me fields={sorted(map(str, body))}"[:500],
                        requested_resource=",".join(map(str, forbidden))[:128], authorization_result="denied",
                        authorization_reason="forbidden field update", blocked_by="forbidden_field_update", final_response="")
        raise HTTPException(403, "Only phone, email, city and state can be changed")
    if p.customer_id is None:
        raise HTTPException(400, "No customer profile is associated with this account")
    for k, v in body.items():
        if not isinstance(v, str) or not v.strip() or len(v) > 128:
            raise HTTPException(422, f"Invalid value for {k}")
        if (k == "phone" and not _PHONE.match(v.strip())) or (k == "email" and not _EMAIL.match(v.strip())):
            raise HTTPException(422, f"Invalid value for {k}")
    customers.update_contact(db, p, {k: v.strip() for k, v in body.items()})
    return _me(db, p)
