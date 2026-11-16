"""Corpus-driven suites. The JSON corpora in tests/data/ are reusable by the external AgentSec tester."""
import json
from pathlib import Path

import pytest

from app.config import get_settings
from app.llm.mock import MockLLM
from tests.conftest import last_log
from app.guardrails import messages as M

DATA = Path(__file__).resolve().parents[1] / "data"
ATTACKS = json.loads((DATA / "attack_corpus.json").read_text(encoding="utf-8"))
FPS = json.loads((DATA / "false_positive_corpus.json").read_text(encoding="utf-8"))["cases"]
STANDARD = {"CROSS_USER": M.CROSS_USER, "SYSTEM_PROMPT": M.SYSTEM_PROMPT, "INJECTION": M.INJECTION, "OUT_OF_SCOPE": M.OUT_OF_SCOPE,
            "SENSITIVE": M.SENSITIVE, "UNVERIFIED": M.UNVERIFIED}
REFUSALS = set(STANDARD.values()) | {M.ERROR, M.RATE_LIMIT, M.LOCKOUT}


@pytest.mark.attack
@pytest.mark.parametrize("case", ATTACKS["input_attacks"], ids=lambda c: c["id"])
def test_input_attack_corpus(chat, db, case):
    r = chat(case["user"], case["message"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reply"] == STANDARD[case["expect"]], case["message"]
    assert body["blocked"] is True
    log = last_log(db)
    assert log.blocked_by and any(e["action"] == "block" for e in log.guardrail_events)
    assert "REF-" not in body["reply"]


def _fill(text: str) -> str:
    s = get_settings()
    return text.replace("{CANARY}", s.system_prompt_canary).replace("{JWT_SECRET}", s.jwt_secret).replace("{MODEL}", s.llm_model)


@pytest.mark.attack
@pytest.mark.parametrize("case", ATTACKS["forced_outputs"], ids=lambda c: c["id"])
def test_forced_output_corpus(chat, db, case):
    MockLLM.next_reply = _fill(case["reply"])
    r = chat(case["user"], "hello there")
    assert r.status_code == 200
    reply, exp = r.json()["reply"], case["expect"]
    if "reply" in exp:
        assert reply == STANDARD[exp["reply"]]
    if "reply_contains" in exp:
        assert exp["reply_contains"] in reply
    for bad in exp.get("reply_not_contains", []):
        assert bad not in reply
    for secret in (get_settings().jwt_secret, "eyJhbGci", "sk-abcdef"):  # never echoed into the log either
        assert secret not in json.dumps(last_log(db).guardrail_events)


@pytest.mark.false_positive
@pytest.mark.parametrize("case", FPS, ids=lambda c: c["id"])
def test_false_positive_corpus(chat, db, case):
    r = chat(case["user"], case["message"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["blocked"] is False and body["reply"] not in REFUSALS and body["reply"].strip(), (case["message"], body["reply"])
    log = last_log(db)
    assert log.blocked_by is None and not any(e["action"] == "block" for e in log.guardrail_events), log.guardrail_events
    flagged = any(e["action"] == "flag" and e["severity"] == "medium" for e in log.guardrail_events)
    if case["flag_only"]:
        assert flagged
