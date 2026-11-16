"""Ollama native /api/chat provider (no streaming: output guardrails need the complete reply)."""
import json
import logging
import re
import uuid

import httpx

from app.config import get_settings
from app.llm.base import CLASSIFIER_PROMPT, LLMError, LLMProvider, LLMResponse, ToolCall

log = logging.getLogger("uvicorn.error")
_TEMPLATE_TOKENS = re.compile(r"<\|[^|>]{1,40}\|>|<>")
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.I)


def _to_ollama_messages(messages: list[dict]) -> list[dict]:
    names: dict[str, str] = {}
    out = []
    for m in messages:
        if m["role"] == "assistant" and m.get("tool_calls"):
            calls = []
            for tc in m["tool_calls"]:
                names[tc["id"]] = tc["function"]["name"]
                args = tc["function"]["arguments"]
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except json.JSONDecodeError:
                        args = {}
                calls.append({"function": {"name": tc["function"]["name"], "arguments": args}})
            out.append({"role": "assistant", "content": m.get("content") or "", "tool_calls": calls})
        elif m["role"] == "tool":
            out.append({"role": "tool", "content": m["content"], "tool_name": names.get(m.get("tool_call_id"), "")})
        else:
            out.append({"role": m["role"], "content": m.get("content") or ""})
    return out


def clean_content(content: str) -> str:
    """Small models sometimes leak chat-template tokens (<|start_header_id|>...) instead of answering.
    Strip them; a reply with no real text left counts as an empty (malformed) response."""
    text = _TEMPLATE_TOKENS.sub("", content)
    text = re.sub(r"^\s*(assistant|user|system)\s*$", "", text, flags=re.I | re.M).strip()
    return text if re.search(r"[A-Za-z0-9\u0900-\u097F]", text) else ""


def _canonical(name: str) -> str:
    """Small models write "Get My Policy" for get_my_policy. Canonicalise the spelling only; authorization still decides."""
    return re.sub(r"[\s\-]+", "_", name.strip()).lower()


def _calls_from_content(content: str) -> list[dict] | None:
    """Small models often write the tool call as JSON text. Parse it; it still goes through authorization."""
    text = _FENCE.sub("", content.strip())
    if not text.startswith(("{", "[")):
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    items = data if isinstance(data, list) else [data]
    calls = []
    for it in items:
        if not isinstance(it, dict):
            return None
        fn = it.get("function") if isinstance(it.get("function"), dict) else it
        name = fn.get("name") or fn.get("tool")
        if not isinstance(name, str) or not ("arguments" in fn or "parameters" in fn):
            return None
        calls.append({"name": _canonical(name), "arguments": fn.get("arguments", fn.get("parameters"))})
    return calls or None


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(self):
        s = get_settings()
        self.base, self.model, self.timeout = s.ollama_base_url.rstrip("/"), s.llm_model, s.llm_timeout_seconds
        self.num_ctx, self.keep_alive = s.ollama_num_ctx, s.ollama_keep_alive

    def _post(self, payload: dict) -> dict:
        try:
            r = httpx.post(f"{self.base}/api/chat", json=payload, timeout=self.timeout)
            r.raise_for_status()
            return r.json()
        except httpx.TimeoutException as e:
            raise LLMError("timeout") from e
        except (httpx.HTTPError, ValueError) as e:
            raise LLMError(type(e).__name__) from e

    def chat(self, messages, tools):
        payload = {"model": self.model, "messages": _to_ollama_messages(messages), "stream": False, "think": False,  # no hidden reasoning pass: faster, and the answer arrives in `content`
                   
                   "options": {"temperature": 0, "num_ctx": self.num_ctx}, "keep_alive": self.keep_alive}
        if tools:
            payload["tools"] = tools
        last = "empty response"
        for attempt in range(2):  # retry once on malformed output, then fail closed
            data = self._post(payload)
            msg = data.get("message") if isinstance(data, dict) else None
            if not isinstance(msg, dict):
                last = "malformed response"
                continue
            calls = [{"name": tc.get("function", {}).get("name"), "arguments": tc.get("function", {}).get("arguments", {})}
                     for tc in (msg.get("tool_calls") or []) if isinstance(tc, dict)]
            content = clean_content(msg.get("content") or "")
            if not calls and content:
                calls = _calls_from_content(content) or []
                if calls:
                    content = ""
            if any(not isinstance(c["name"], str) for c in calls):
                last = "malformed tool call"
                continue
            if not calls and not content:
                last = "empty response"
                continue
            return LLMResponse(content or None, [ToolCall("call_" + uuid.uuid4().hex[:12], c["name"], c["arguments"]) for c in calls],
                               {"provider": "ollama", "model": self.model, "attempt": attempt + 1, "eval_count": data.get("eval_count"),
                                "tool_calls": [{"tool": c["name"], "arguments": c["arguments"]} for c in calls]})
        raise LLMError(last)

    def classify(self, message):
        payload = {"model": self.model, "stream": False, "format": "json", "options": {"temperature": 0, "num_ctx": self.num_ctx},
                   "keep_alive": self.keep_alive,
                   "messages": [{"role": "system", "content": CLASSIFIER_PROMPT}, {"role": "user", "content": message}]}
        return json.loads(self._post(payload)["message"]["content"] or "{}")

    def status(self) -> dict:
        try:
            r = httpx.get(f"{self.base}/api/tags", timeout=3)
            names = {m.get("name") for m in r.json().get("models", [])}
            ok = self.model in names or f"{self.model}:latest" in names
            return {"reachable": True, "model_available": ok}
        except (httpx.HTTPError, ValueError):
            return {"reachable": False, "model_available": False}

    def startup_check(self) -> None:
        st = self.status()
        if not st["reachable"]:
            log.warning("Ollama is not reachable at %s. Start it (`ollama serve`) and run `ollama pull %s`. Chat returns an error until then.", self.base, self.model)
        elif not st["model_available"]:
            log.warning("Ollama model %r is not pulled. Run: ollama pull %s", self.model, self.model)
