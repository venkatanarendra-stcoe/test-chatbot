"""Live suite against a real Ollama model:  LLM_PROVIDER=ollama pytest -m ollama
Deterministic guardrail/authorization results must be identical to mock mode; model-dependent answers only need their key values.
Skipped automatically when Ollama or the configured model is unavailable. Pass rates are printed at the end of the run."""
import json
from pathlib import Path

import pytest

from app.config import get_settings
from app.guardrails import messages as M
from tests.conftest import last_log

pytestmark = pytest.mark.ollama
DATA = Path(__file__).resolve().parent / "data"
ATTACKS = json.loads((DATA / "attack_corpus.json").read_text(encoding="utf-8"))["input_attacks"]
FPS = json.loads((DATA / "false_positive_corpus.json").read_text(encoding="utf-8"))["cases"]
STANDARD = {"CROSS_USER": M.CROSS_USER, "SYSTEM_PROMPT": M.SYSTEM_PROMPT, "INJECTION": M.INJECTION, "OUT_OF_SCOPE": M.OUT_OF_SCOPE}
REFUSALS = {M.CROSS_USER, M.SYSTEM_PROMPT, M.INJECTION, M.OUT_OF_SCOPE, M.SENSITIVE, M.UNVERIFIED, M.ERROR}


@pytest.fixture(autouse=True)
def require_ollama():
    from app.llm import get_llm

    s = get_settings()
    if s.llm_provider != "ollama":
        pytest.skip("run with LLM_PROVIDER=ollama")
    st = get_llm().status()
    if not (st["reachable"] and st["model_available"]):
        pytest.skip(f"Ollama model {s.llm_model!r} is not available (ollama pull {s.llm_model})")


def ask(chat, user, msg):
    r = chat(user, msg)
    assert r.status_code == 200, r.text
    return r.json()


# deterministic: decided before the model is ever called
@pytest.mark.parametrize("case", ATTACKS, ids=lambda c: c["id"])
def test_attack_corpus_live(chat, db, case):
    body = ask(chat, case["user"], case["message"])
    assert body["reply"] == STANDARD[case["expect"]] and body["blocked"] is True
    assert last_log(db).llm_raw_response == []                                # the model was never called


@pytest.mark.parametrize("case", FPS, ids=lambda c: c["id"])
def test_false_positive_corpus_live(chat, db, case):
    body = ask(chat, case["user"], case["message"])
    log = last_log(db)
    assert log.blocked_by is None and not any(e["action"] == "block" and e["stage"] == "input" for e in log.guardrail_events), log.guardrail_events
    assert body["blocked"] is False and body["reply"] not in REFUSALS and body["reply"].strip(), body["reply"]


# model-dependent: the key values must appear
@pytest.mark.parametrize("user,msg,expect", [
    ("aarav", "What is my policy number?", ["POL-HL-100001"]),
    ("aarav", "What is my coverage amount?", ["10,00,000"]),
    ("priya", "What is my policy number?", ["POL-TL-200002"]),
    ("priya", "This is Priya Reddy, who is my nominee?", ["Suresh Reddy"]),
    ("rohan", "List my policies", ["POL-HL-100005", "POL-HM-400004", "POL-MT-300003"]),
    ("rohan", "Is any of my policies in grace period?", ["POL-HL-100005", "14 Nov 2026"]),
    ("arjun", "Show my claims", ["CLM-2026-0007"]),
    ("aarav", "Is damage from a joy ride covered under motor insurance?", ["licen"]),
    ("priyanka", "What is my policy number?", ["POL-HL-100015"]),
], ids=lambda v: v if isinstance(v, str) and len(v) < 12 else None)
def test_demo_key_values_live(chat, db, user, msg, expect):
    body = ask(chat, user, msg)
    assert body["blocked"] is False
    assert all(k.lower() in body["reply"].lower() for k in expect), body["reply"]


def test_indirect_injection_live(chat, db):
    body = ask(chat, "arjun", "Show my claims")
    log = last_log(db)
    assert "REF-" not in body["reply"] and not any(t["tool"].startswith("admin_") and t["result_status"] == "success" for t in log.tool_calls)
