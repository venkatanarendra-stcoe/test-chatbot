from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import text

from app.config import get_settings
from tests.conftest import PASSWORDS


def test_login_ok(client):
    r = client.post("/api/login", json={"username": "aarav", "password": "Aarav@123"})
    assert r.status_code == 200
    b = r.json()
    assert b["token_type"] == "bearer" and b["expires_in"] == get_settings().jwt_expire_minutes * 60
    assert b["user"] == {"username": "aarav", "role": "customer", "name": "Aarav Sharma"}
    claims = jwt.decode(b["access_token"], get_settings().jwt_secret, algorithms=["HS256"])
    assert set(claims) == {"sub", "jti", "iat", "exp"} and len(claims["sub"]) == 36   # sub is the user's UUID


@pytest.mark.parametrize("u,p", [("aarav", "wrong"), ("nobody", "x"), ("sneha", "Sneha@123")])
def test_login_failures_identical(client, u, p):
    r = client.post("/api/login", json={"username": u, "password": p})
    assert r.status_code == 401 and r.json() == {"detail": "Invalid credentials"}


def _tok(claims=None, secret=None, alg="HS256", sub="00000000-0000-4000-8000-0000000000aa"):
    now = datetime.now(timezone.utc)
    c = {"sub": sub, "jti": "abc", "iat": now, "exp": now + timedelta(minutes=5)}
    c.update(claims or {})
    return jwt.encode(c, secret or get_settings().jwt_secret, algorithm=alg)


def test_missing_token(client):
    assert client.get("/api/me").status_code == 401


@pytest.mark.parametrize("token", [
    "garbage", _tok({"exp": datetime.now(timezone.utc) - timedelta(minutes=1)}),
    _tok(secret="a-different-secret-a-different-secret-1234"),
    jwt.encode({"sub": "00000000-0000-4000-8000-0000000000aa", "jti": "x", "iat": 1, "exp": 4102444800}, None, algorithm="none"),
    _tok(sub="not-a-uuid"),
])
def test_bad_tokens(client, token):
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_tampered_payload(client, login):
    h, p, s = login("aarav")["Authorization"].split()[1].split(".")
    assert client.get("/api/me", headers={"Authorization": f"Bearer {h}.{p[:-2]}xx.{s}"}).status_code == 401


def test_role_claim_in_token_ignored(client, owner_db, login):
    uid = owner_db.execute(text("SELECT id FROM users WHERE username='aarav'")).scalar()
    t = _tok({"role": "admin", "customer_id": "CUST-1002"}, sub=str(uid))
    h = {"Authorization": f"Bearer {t}"}
    assert client.get("/api/admin/customers", headers=h).status_code == 403
    assert client.get("/api/me", headers=h).json()["profile"]["customer_id"] == "CUST-1001"


def test_logout_revokes(client, login):
    h = login("priya")
    assert client.get("/api/me", headers=h).status_code == 200
    assert client.post("/api/logout", headers=h).status_code == 200
    assert client.get("/api/me", headers=h).status_code == 401
    assert client.post("/api/chat", json={"message": "hi"}, headers=h).status_code == 401


def test_disabled_after_login(client, owner_db, login):
    h = login("rohan")
    owner_db.execute(text("UPDATE users SET is_active=false WHERE username='rohan'"))
    owner_db.commit()
    assert client.get("/api/me", headers=h).status_code == 401
    assert client.post("/api/login", json={"username": "rohan", "password": PASSWORDS["rohan"]}).status_code == 401


def test_health_exposes_nothing_else(client):
    r = client.get("/api/health")
    assert r.json() == {"status": "ok"} and set(r.headers) <= {"content-length", "content-type", "vary"}  # no server/version headers beyond CORS Vary
    assert client.get("/docs").status_code == 200
