from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = Field(default=None, max_length=64)


class ChatResponse(BaseModel):
    request_id: str
    conversation_id: str
    reply: str
    blocked: bool = False  # true when a guardrail refused; rule details are never exposed to customers
