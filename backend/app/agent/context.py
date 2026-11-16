"""The trusted execution context (`ctx`). Built ONLY by the auth layer from the verified token + the users table;
role/customer_id come from the DB row, never from token claims, request bodies, chat text or LLM output."""
import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class Principal:
    user_id: uuid.UUID
    username: str
    role: str
    customer_id: str | None
    jti: str

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"
