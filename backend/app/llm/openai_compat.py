"""Any OpenAI-compatible chat completions endpoint (OPENAI_BASE_URL, OPENAI_API_KEY, LLM_MODEL)."""
import json

from app.config import get_settings
from app.llm.base import CLASSIFIER_PROMPT, LLMError, LLMProvider, LLMResponse, ToolCall


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self):
        from openai import OpenAI

        s = get_settings()
        self.model = s.llm_model
        self.client = OpenAI(base_url=s.openai_base_url or None, api_key=s.openai_api_key or "missing", timeout=s.llm_timeout_seconds)

    def chat(self, messages, tools):
        kwargs = {"model": self.model, "messages": messages, "temperature": 0}
        if tools:
            kwargs["tools"] = tools
        try:
            resp = self.client.chat.completions.create(**kwargs)
        except Exception as e:  # network/auth/etc: no details to the user
            raise LLMError(type(e).__name__) from e
        msg = resp.choices[0].message
        calls = []
        for tc in msg.tool_calls or []:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = tc.function.arguments
            calls.append(ToolCall(tc.id, tc.function.name, args))
        return LLMResponse(msg.content, calls, {"provider": "openai", "model": self.model, "message": msg.model_dump(exclude_none=True)})

    def classify(self, message):
        resp = self.client.chat.completions.create(model=self.model, temperature=0,
                                                   messages=[{"role": "system", "content": CLASSIFIER_PROMPT}, {"role": "user", "content": message}])
        return json.loads(resp.choices[0].message.content or "{}")
