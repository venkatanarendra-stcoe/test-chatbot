from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import Principal, get_current_user
from app.auth.jwt import create_access_token
from app.auth.passwords import DUMMY_HASH, verify_password
from app.db.engines import get_db
from app.models.db import Customer, RevokedToken, User
from app.schemas.requests import LoginRequest

router = APIRouter(prefix="/api")


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == body.username))
    ok = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if user is None or not ok or not user.is_active:
        raise HTTPException(401, "Invalid credentials")  # identical for every failure
    token, _, expires_in = create_access_token(user.id)
    cust = db.get(Customer, user.customer_id) if user.customer_id else None
    return {"access_token": token, "token_type": "bearer", "expires_in": expires_in,
            "user": {"username": user.username, "role": user.role, "name": cust.full_name if cust else "Platform Admin"}}


@router.post("/logout")
def logout(p: Principal = Depends(get_current_user), db: Session = Depends(get_db)):
    if db.get(RevokedToken, p.jti) is None:
        db.add(RevokedToken(jti=p.jti))
        db.commit()
    return {"status": "logged_out"}
