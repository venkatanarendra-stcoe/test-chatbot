"""Application settings, read from environment variables / backend/.env."""
import secrets
from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
APP_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # three engines / three least-privilege roles (§4.4)
    database_url: str = "postgresql+psycopg://ia_app:change_me@localhost:5432/insurance_agent"
    tools_database_url: str = "postgresql+psycopg://ia_tools:change_me@localhost:5432/insurance_agent"
    migrations_database_url: str = "postgresql+psycopg://ia_owner:change_me@localhost:5432/insurance_agent"
    test_database_url: str = "postgresql+psycopg://ia_owner:change_me@localhost:5432/insurance_agent_test"

    jwt_secret: str = ""
    jwt_expire_minutes: int = 30

    llm_provider: str = "ollama"  # ollama | openai | mock
    ollama_base_url: str = "http://10.10.12.3:11434"
    llm_model: str = "qwen2.5:7b"
    ollama_num_ctx: int = 8192
    ollama_keep_alive: str = "30m"
    llm_timeout_seconds: float = 120
    openai_base_url: str = ""
    openai_api_key: str = ""
    agent_max_tool_iterations: int = 5
    system_prompt_canary: str = ""

    # guardrails (§5.4.8). The identity rule, authorization, ia_tools+RLS, read-only tools and fail-closed are never configurable.
    guardrails_input: bool = True
    guardrails_tool: bool = True
    guardrails_output: bool = True
    guardrail_llm_classifier: bool = False
    rate_limit_per_minute: int = 20
    lockout_enabled: bool = True
    lockout_threshold: int = 5
    lockout_window_minutes: float = 10
    lockout_duration_minutes: float = 10
    tool_timeout_seconds: float = 5.0
    max_reply_chars: int = 4000

    frontend_origin: str = "http://localhost:5173"
    host: str = "127.0.0.1"
    port: int = 8000
    reload: bool = False
    debug: bool = False
    bcrypt_rounds: int = 12
    log_dir: str = str(BACKEND_DIR / "logs")

    @property
    def guardrails_degraded(self) -> bool:
        return not (self.guardrails_input and self.guardrails_tool and self.guardrails_output)

    @model_validator(mode="after")
    def _fill_defaults(self):
        # No secret in source: an unset secret becomes a random per-process value.
        if not self.jwt_secret:
            self.jwt_secret = secrets.token_urlsafe(48)
        if not self.system_prompt_canary:
            self.system_prompt_canary = "canary-" + secrets.token_hex(8)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
