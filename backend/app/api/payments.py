from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import Principal, get_current_user
from app.db.engines import get_db
from app.repositories import payments

router = APIRouter(prefix="/api")


@router.get("/my-payments")
def my_payments(mode: str | None = Query(None, max_length=24), status: str | None = Query(None, max_length=12), policy_number: str | None = Query(None, max_length=20),
                p: Principal = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"payments": payments.list_for(db, p, mode, status, policy_number)}
