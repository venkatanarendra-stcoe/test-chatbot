from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import Principal, get_current_user
from app.db.engines import get_db
from app.repositories import claims
from app.services import knowledge

router = APIRouter(prefix="/api")


@router.get("/my-claims")
def my_claims(status: str | None = Query(None, max_length=24), p: Principal = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"claims": claims.list_for(db, p, status)}


@router.get("/my-claims/{claim_number}")
def my_claim(claim_number: str, p: Principal = Depends(get_current_user), db: Session = Depends(get_db)):
    c = claims.get_for(db, p, claim_number)
    if c is None:
        raise HTTPException(404, "Claim not found")
    return c


@router.get("/claims-info")
def claims_info(product: str | None = Query(None, max_length=40), _: Principal = Depends(get_current_user)):
    return knowledge.claim_information(product)
