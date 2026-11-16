import uuid

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.agent.context import Principal
from app.auth.jwt import decode_access_token
from app.db.engines import get_db
from app.models.db import RevokedToken, User

_bearer = HTTPBearer(auto_error=False)
_UNAUTH = HTTPException(401, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})

__all__ = ["Principal", "get_current_user", "require_admin"]


def principal_from_token(db: Session, token: str) -> Principal | None:
    """Verify a JWT and rebuild the principal from the database (role and customer_id are never taken from the token)."""
    claims = decode_access_token(token)
    if claims is None or db.get(RevokedToken, claims["jti"]) is not None:
        return None
    user = db.get(User, uuid.UUID(claims["sub"]))
    if user is None or not user.is_active:
        return None
    return Principal(user.id, user.username, user.role, user.customer_id, claims["jti"])


def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer), db: Session = Depends(get_db)) -> Principal:
    if creds is None or creds.scheme.lower() != "bearer":
        raise _UNAUTH
    principal = principal_from_token(db, creds.credentials)
    if principal is None:
        raise _UNAUTH
    return principal


def require_admin(p: Principal = Depends(get_current_user)) -> Principal:
    if not p.is_admin:
        raise HTTPException(403, "Admin access required")
    return p
