from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import Principal, get_current_user
from app.db.engines import get_db
from app.repositories import policies

router = APIRouter(prefix="/api")


@router.get("/my-policies")
def my_policies(status: str | None = Query(None, max_length=24), type: str | None = Query(None, max_length=16), q: str | None = Query(None, max_length=64),
                p: Principal = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"policies": policies.list_for(db, p, status, type, q)}


@router.get("/my-policies/{policy_number}")
def my_policy(policy_number: str, p: Principal = Depends(get_current_user), db: Session = Depends(get_db)):
    pol = policies.get_for(db, p, policy_number)
    if pol is None:  # not owned == not found
        raise HTTPException(404, "Policy not found")
    return pol


@router.post("/my-policies/{policy_number}/renew")
def renew_policy(policy_number: str, body: dict = Body(default_factory=dict), p: Principal = Depends(get_current_user), db: Session = Depends(get_db)):
    """Renew one of the caller's own policies for another year; the premium is recorded as a successful payment."""
    mode = body.get("mode", "UPI")
    if set(body) - {"mode"} or mode not in policies.PAYMENT_MODES:
        raise HTTPException(422, "Invalid renewal request")
    try:
        res = policies.renew(db, p, policy_number, mode)
    except policies.NotRenewable:
        raise HTTPException(409, "This policy cannot be renewed online")
    if res is None:  # not owned == not found
        raise HTTPException(404, "Policy not found")
    return {"policy": res[0], "payment": res[1]}
