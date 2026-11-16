import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.config import get_settings

ALGORITHM = "HS256"


def create_access_token(user_id) -> tuple[str, str, int]:
    """Returns (token, jti, expires_in_seconds). `sub` is the user's UUID."""
    s = get_settings()
    now = datetime.now(timezone.utc)
    jti = uuid.uuid4().hex
    claims = {"sub": str(user_id), "jti": jti, "iat": now, "exp": now + timedelta(minutes=s.jwt_expire_minutes)}
    return jwt.encode(claims, s.jwt_secret, algorithm=ALGORITHM), jti, s.jwt_expire_minutes * 60


def decode_access_token(token: str) -> dict | None:
    """Verified claims, or None for any expired/forged/malformed token (incl. alg=none)."""
    try:
        claims = jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM],  # pinned: "none" etc. rejected
                            options={"require": ["exp", "iat", "sub", "jti"]})
        uuid.UUID(claims["sub"])
        return claims
    except (jwt.PyJWTError, ValueError, TypeError, KeyError):
        return None
