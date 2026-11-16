import os
import tempfile
from argparse import Namespace
from pathlib import Path

from sqlalchemy.engine import make_url

from app.config import BACKEND_DIR, Settings

# Must happen before any app import that caches settings: use the TEST database for all three roles, the mock LLM, fast bcrypt.
_s = Settings()
_test = make_url(_s.test_database_url)
_render = lambda u: u.render_as_string(hide_password=False)  # noqa: E731
os.environ.update(
    DATABASE_URL=_render(make_url(_s.database_url).set(database=_test.database, host=_test.host, port=_test.port)),
    TOOLS_DATABASE_URL=_render(make_url(_s.tools_database_url).set(database=_test.database, host=_test.host, port=_test.port)),
    MIGRATIONS_DATABASE_URL=_render(_test),
    LOG_DIR=tempfile.mkdtemp(prefix="insurance-tests-"),
    BCRYPT_ROUNDS="4",
    LLM_PROVIDER=os.environ.get("LLM_PROVIDER", "mock"),
    JWT_EXPIRE_MINUTES="720",  # long live-model runs must not outlive cached tokens
    JWT_SECRET="test-secret-test-secret-test-secret-123456",
    SYSTEM_PROMPT_CANARY="CANARY-TEST-9d41",
    AGENT_MAX_TOOL_ITERATIONS="5",
    RATE_LIMIT_PER_MINUTE="20",
)

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db.engines import SessionLocal, owner_engine  # noqa: E402
from app.guardrails.rate_limit import limiter  # noqa: E402
from app.llm import reset_llm  # noqa: E402
from app.llm.mock import MockLLM  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import reset_runtime, seed  # noqa: E402

PASSWORDS = {"aarav": "Aarav@123", "priya": "Priya@123", "rohan": "Rohan@123", "ananya": "Ananya@123", "vikram": "Vikram@123",
             "sneha": "Sneha@123", "joy": "Joy@123", "arjun": "Arjun@123", "meera": "Meera@123", "sanjay": "Sanjay@123",
             "priyanka": "Priyanka@123", "admin": "Admin@123"}
CUSTOMERS = [u for u in PASSWORDS if u not in ("admin", "sneha")]  # the 10 active customers
CUSTOMER_IDS = {"aarav": "CUST-1001", "priya": "CUST-1002", "rohan": "CUST-1003", "ananya": "CUST-1004", "vikram": "CUST-1005", "sneha": "CUST-1006",
                "joy": "CUST-1007", "arjun": "CUST-1008", "meera": "CUST-1009", "sanjay": "CUST-1010", "priyanka": "CUST-1011"}
POLICIES = {"aarav": ["POL-HL-100001"], "priya": ["POL-TL-200002"], "rohan": ["POL-HL-100005", "POL-HM-400004", "POL-MT-300003"],
            "ananya": ["POL-HL-100006"], "vikram": ["POL-TL-200008", "POL-TR-500007"], "joy": ["POL-MT-300010"], "arjun": ["POL-HM-400011"],
            "meera": ["POL-HL-100012"], "sanjay": ["POL-MT-300014", "POL-TL-200013"], "priyanka": ["POL-HL-100015"]}
CLAIMS = {"aarav": ["CLM-2026-0001", "CLM-2026-0002"], "rohan": ["CLM-2026-0003", "CLM-2026-0004"], "ananya": ["CLM-2026-0005"], "vikram": ["CLM-2026-0006"],
          "joy": ["CLM-2026-0010"], "arjun": ["CLM-2026-0007"], "meera": ["CLM-2026-0008", "CLM-2026-0009"], "priyanka": ["CLM-2026-0011"]}
ALICE_CONV = AARAV_CONV = "00000000-0000-4000-8000-000000000001"

from app.guardrails import messages as M  # noqa: E402

REFUSAL, PROMPT_REFUSAL, INJECTION, OUT_OF_SCOPE, SENSITIVE, UNVERIFIED = (M.CROSS_USER, M.SYSTEM_PROMPT, M.INJECTION, M.OUT_OF_SCOPE, M.SENSITIVE, M.UNVERIFIED)


@pytest.fixture(scope="session", autouse=True)
def database():
    """Fresh schema via Alembic + seed, once per session, in the dedicated test database (never the dev database)."""
    owner = create_engine(os.environ["MIGRATIONS_DATABASE_URL"])
    with owner.begin() as c:
        c.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        c.execute(text("CREATE SCHEMA public"))
    owner.dispose()
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")
    with Session(owner_engine()) as db:
        seed(db, reset=True)
    yield


@pytest.fixture(autouse=True)
def fresh_state(database):
    with Session(owner_engine()) as db:
        reset_runtime(db)
    MockLLM.reset()
    limiter.reset()
    reset_llm()
    yield
    MockLLM.reset()
    limiter.reset()


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def db():
    with SessionLocal() as s:
        yield s


@pytest.fixture
def owner_db():
    with Session(owner_engine()) as s:
        yield s


@pytest.fixture
def cfg(monkeypatch):
    def _set(**kw):
        for k, v in kw.items():
            monkeypatch.setattr(get_settings(), k, v)
    return _set


_tokens: dict[str, str] = {}


@pytest.fixture
def login(client):
    def _login(username: str) -> dict:
        if username not in _tokens:
            r = client.post("/api/login", json={"username": username, "password": PASSWORDS[username]})
            assert r.status_code == 200, r.text
            _tokens[username] = r.json()["access_token"]
        return {"Authorization": f"Bearer {_tokens[username]}"}

    return _login


@pytest.fixture
def chat(client, login):
    def _chat(user: str, message: str, conversation_id: str | None = None):
        body = {"message": message}
        if conversation_id:
            body["conversation_id"] = conversation_id
        return client.post("/api/chat", json=body, headers=login(user))

    return _chat


def last_log(db):
    from sqlalchemy import select

    from app.models.db import AgentLog

    db.expire_all()
    return db.scalars(select(AgentLog).order_by(AgentLog.created_at.desc())).first()


def pytest_terminal_summary(terminalreporter):
    """Pass rates per suite (attack / false_positive / ollama)."""
    stats = terminalreporter.stats
    rows = []
    for marker in ("attack", "false_positive", "ollama"):
        res = {k: [r for r in stats.get(k, []) if marker in getattr(r, "keywords", {}) and r.when == "call"] for k in ("passed", "failed")}
        total = len(res["passed"]) + len(res["failed"])
        if total:
            rows.append(f"{marker:15s} {len(res['passed'])}/{total} passed ({100 * len(res['passed']) / total:.1f}%)")
    if rows:
        terminalreporter.write_sep("-", "suite pass rates")
        for r in rows:
            terminalreporter.write_line(r)
