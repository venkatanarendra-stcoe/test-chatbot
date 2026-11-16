"""Ollama / OpenAI-compatible providers exercised with stubs (no network, no Ollama needed)."""
import json
from types import SimpleNamespace as NS

import httpx
import pytest

import app.llm as llm_pkg
from app.agent.orchestrator import handle_chat
from app.agent.context import Principal
from app.guardrails import messages as M
from app.llm import LLMError
from app.llm.ollama import OllamaProvider, _calls_from_content, _to_ollama_messages


class FakeHTTP:
    def __init__(self, replies):
        self.replies, self.seen = list(replies), []

    def post(self, url, json=None, timeout=None):
        self.seen.append((url, json, timeout))
        r = self.replies.pop(0)
        if isinstance(r, Exception):
            raise r
        return NS(raise_for_status=lambda: None, json=lambda: r)


def provider(monkeypatch, replies):
    http = FakeHTTP(replies)
    monkeypatch.setattr("app.llm.ollama.httpx.post", http.post)
    return OllamaProvider(), http


def msg(content="", calls=None):
    return {"message": {"role": "assistant", "content": content, **({"tool_calls": calls} if calls else {})}, "eval_count": 7}


def test_request_shape(monkeypatch):
    p, http = provider(monkeypatch, [msg("hello")])
    r = p.chat([{"role": "system", "content": "s"}, {"role": "user", "content": "hi"}], [{"type": "function", "function": {"name": "x"}}])
    url, body, timeout = http.seen[0]
    assert url.endswith("/api/chat") and body["stream"] is False and body["options"]["temperature"] == 0 and body["options"]["num_ctx"] == p.num_ctx
    assert body["keep_alive"] == p.keep_alive and body["model"] == p.model and body["tools"] and timeout == p.timeout and r.content == "hello"


def test_native_tool_calls(monkeypatch):
    p, _ = provider(monkeypatch, [msg("", [{"function": {"name": "get_my_policy", "arguments": {}}}])])
    r = p.chat([{"role": "user", "content": "x"}], [])
    assert r.tool_calls[0].name == "get_my_policy" and r.tool_calls[0].arguments == {}


@pytest.mark.parametrize("content", ['{"name": "get_my_policy", "arguments": {}}', '```json\n{"name": "get_my_policy", "parameters": {}}\n```',
                                     '[{"name": "get_my_policy", "arguments": {}}]', '{"function": {"name": "get_my_policy", "arguments": {}}}'])
def test_tool_call_written_as_json_in_content(monkeypatch, content):
    p, _ = provider(monkeypatch, [msg(content)])
    r = p.chat([{"role": "user", "content": "x"}], [])
    assert [t.name for t in r.tool_calls] == ["get_my_policy"] and not r.content


def test_plain_json_answer_is_not_a_tool_call():
    assert _calls_from_content('{"policy": "POL-HL-100001"}') is None and _calls_from_content("hello") is None


def test_retry_once_on_malformed_then_ok(monkeypatch):
    p, http = provider(monkeypatch, [{"unexpected": True}, msg("ok")])
    assert p.chat([{"role": "user", "content": "x"}], []).content == "ok" and len(http.seen) == 2


def test_two_malformed_outputs_fail_closed(monkeypatch):
    p, http = provider(monkeypatch, [msg(""), msg("")])
    with pytest.raises(LLMError):
        p.chat([{"role": "user", "content": "x"}], [])
    assert len(http.seen) == 2


def test_timeout_and_http_errors_become_llm_error(monkeypatch):
    p, _ = provider(monkeypatch, [httpx.ReadTimeout("slow")])
    with pytest.raises(LLMError, match="timeout"):
        p.chat([{"role": "user", "content": "x"}], [])
    p, _ = provider(monkeypatch, [httpx.ConnectError("down")])
    with pytest.raises(LLMError):
        p.chat([{"role": "user", "content": "x"}], [])


def test_message_conversion_for_tool_round_trip():
    out = _to_ollama_messages([
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": None, "tool_calls": [{"id": "c1", "type": "function", "function": {"name": "get_my_policy", "arguments": "{}"}}]},
        {"role": "tool", "tool_call_id": "c1", "content": "<<TOOL_RESULT id=a>>{}<<END_TOOL_RESULT id=a>>"}])
    assert out[1]["tool_calls"][0]["function"]["arguments"] == {} and out[2]["tool_name"] == "get_my_policy"


def test_status_and_startup_warning(monkeypatch, caplog):
    monkeypatch.setattr("app.llm.ollama.httpx.get", lambda url, timeout=None: NS(json=lambda: {"models": [{"name": "other:1b"}]}))
    p = OllamaProvider()
    assert p.status() == {"reachable": True, "model_available": False}
    with caplog.at_level("WARNING", logger="uvicorn.error"):
        p.startup_check()
    assert f"ollama pull {p.model}" in caplog.text
    monkeypatch.setattr("app.llm.ollama.httpx.get", lambda *a, **k: (_ for _ in ()).throw(httpx.ConnectError("x")))
    assert p.status()["reachable"] is False


def _principal(db_user="aarav"):
    from sqlalchemy import text
    from sqlalchemy.orm import Session

    from app.db.engines import owner_engine
    with Session(owner_engine()) as s:
        uid = s.execute(text("SELECT id FROM users WHERE username=:u"), {"u": db_user}).scalar()
    return Principal(uid, db_user, "customer", "CUST-1001", "jti")


def test_ollama_goes_through_same_pipeline(monkeypatch, db):
    p, http = provider(monkeypatch, [msg("", [{"function": {"name": "get_my_policy", "arguments": {}}}]), msg("Your policy number is POL-HL-100001.")])
    monkeypatch.setattr(llm_pkg, "_provider", p)
    res = handle_chat(db, _principal(), "What is my policy number?", None)
    assert res.reply == "Your policy number is POL-HL-100001." and not res.blocked
    second = http.seen[1][1]["messages"]
    assert second[-1]["role"] == "tool" and second[-1]["content"].startswith("<<TOOL_RESULT id=")


def test_hallucinated_admin_call_from_model_is_denied(monkeypatch, db):
    p, _ = provider(monkeypatch, [msg("", [{"function": {"name": "admin_list_customers", "arguments": {}}}]), msg("Here are all customers REF-PRIYA-2C9E")])
    monkeypatch.setattr(llm_pkg, "_provider", p)
    assert handle_chat(db, _principal(), "hello", None).reply == M.CROSS_USER


def test_provider_error_returns_error_message(monkeypatch, db):
    p, _ = provider(monkeypatch, [httpx.ConnectError("down")])
    monkeypatch.setattr(llm_pkg, "_provider", p)
    res = handle_chat(db, _principal(), "What is my policy number?", None)
    assert res.reply == M.ERROR and "Connect" not in res.reply


def test_openai_provider_parses_tool_calls(monkeypatch, db):
    from app.llm.openai_compat import OpenAIProvider

    msgs = [NS(content=None, tool_calls=[NS(id="c0", function=NS(name="get_my_policy", arguments="{}"))], model_dump=lambda **k: {}),
            NS(content="Your policy number is POL-HL-100001.", tool_calls=None, model_dump=lambda **k: {})]
    p = OpenAIProvider.__new__(OpenAIProvider)
    p.model = "stub"
    p.client = NS(chat=NS(completions=NS(create=lambda **kw: NS(choices=[NS(message=msgs.pop(0))]))))
    monkeypatch.setattr(llm_pkg, "_provider", p)
    assert handle_chat(db, _principal(), "What is my policy number?", None).reply == "Your policy number is POL-HL-100001."


def test_ollama_template_token_leak_is_treated_as_empty():
    from app.llm.ollama import clean_content
    assert clean_content("<|start_header_id|>assistant<|end_header_id|>\n\n<>") == ""
    assert clean_content("<|start_header_id|>assistant<|end_header_id|>\n\nYou have 1 failed payment.") == "You have 1 failed payment."
    assert clean_content("All good.") == "All good."
