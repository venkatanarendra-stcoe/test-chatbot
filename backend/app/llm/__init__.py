from app.config import get_settings
from app.llm.base import LLMError, LLMProvider, LLMResponse, ToolCall  # noqa: F401

_provider: LLMProvider | None = None


def get_llm() -> LLMProvider:
    global _provider
    if _provider is None:
        name = get_settings().llm_provider
        if name == "mock":
            from app.llm.mock import MockLLM

            _provider = MockLLM()
        elif name == "openai":
            from app.llm.openai_compat import OpenAIProvider

            _provider = OpenAIProvider()
        else:
            from app.llm.ollama import OllamaProvider

            _provider = OllamaProvider()
    return _provider


def reset_llm() -> None:
    global _provider
    _provider = None
