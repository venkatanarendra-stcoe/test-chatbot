"""SQLAlchemy models (PostgreSQL 16). Mirrors the Alembic migration."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (Boolean, CheckConstraint, Computed, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, text)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, utcnow

PRODUCT_TYPES = ("Health", "Life", "Motor", "Home", "Travel")
POLICY_STATUSES = ("Active", "Grace Period", "Lapsed", "Expired", "Pending")
CLAIM_STATUSES = ("Submitted", "Documents Pending", "Under Review", "Approved", "Settled", "Rejected")
PAYMENT_STATUSES = ("Success", "Failed", "Pending")


def _in(col: str, values) -> str:
    return f"{col} IN ({', '.join(repr(v) for v in values)})"


def _uuid_pk():
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))


class Customer(Base):
    __tablename__ = "customers"

    customer_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(128))
    email: Mapped[str] = mapped_column(String(128))
    phone: Mapped[str] = mapped_column(String(32))
    date_of_birth: Mapped[date] = mapped_column(Date)
    city: Mapped[str] = mapped_column(String(64))
    state: Mapped[str] = mapped_column(String(64))
    pan: Mapped[str] = mapped_column(String(32))
    account_reference: Mapped[str] = mapped_column(String(32), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=text("now()"))
    # generated so that tools can read a masked PAN without any privilege on the `pan` column
    pan_masked: Mapped[str] = mapped_column(String(32), Computed("'******' || right(pan, 4)", persisted=True), nullable=True)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('customer','admin')", name="ck_users_role"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(16))
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.customer_id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=text("now()"))


class Policy(Base):
    __tablename__ = "policies"
    __table_args__ = (
        CheckConstraint(_in("policy_type", PRODUCT_TYPES), name="ck_policies_type"),
        CheckConstraint(_in("status", POLICY_STATUSES), name="ck_policies_status"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    policy_number: Mapped[str] = mapped_column(String(20), unique=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), index=True)
    product: Mapped[str] = mapped_column(String(64))
    policy_type: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16))
    sum_insured: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    annual_premium: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    deductible: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    nominee: Mapped[str | None] = mapped_column(String(128), nullable=True)
    details: Mapped[dict] = mapped_column(JSONB, default=dict, server_default=text("'{}'::jsonb"))


class Claim(Base):
    __tablename__ = "claims"
    __table_args__ = (CheckConstraint(_in("status", CLAIM_STATUSES), name="ck_claims_status"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    claim_number: Mapped[str] = mapped_column(String(20), unique=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), index=True)
    policy_number: Mapped[str] = mapped_column(ForeignKey("policies.policy_number"))
    claim_type: Mapped[str] = mapped_column(String(64))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(24))
    filed_date: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(Text)


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (CheckConstraint(_in("status", PAYMENT_STATUSES), name="ck_payments_status"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    payment_id: Mapped[str] = mapped_column(String(24), unique=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.customer_id"), index=True)
    policy_number: Mapped[str] = mapped_column(ForeignKey("policies.policy_number"))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    paid_on: Mapped[date] = mapped_column(Date)
    mode: Mapped[str] = mapped_column(String(24))
    status: Mapped[str] = mapped_column(String(12))


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    session_id: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=text("now()"))


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (CheckConstraint("role IN ('user','assistant','tool')", name="ck_messages_role"),
                      Index("ix_messages_conv_created", "conversation_id", "created_at"))

    id: Mapped[uuid.UUID] = _uuid_pk()
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    request_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    blocked: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=text("clock_timestamp()"))


class AgentLog(Base):
    __tablename__ = "agent_logs"
    __table_args__ = (CheckConstraint("authorization_result IN ('allowed','denied','none')", name="ck_logs_auth"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    request_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    query: Mapped[str] = mapped_column(Text)
    requested_resource: Mapped[str | None] = mapped_column(String(128), nullable=True)
    tool_calls: Mapped[list] = mapped_column(JSONB, default=list)
    authorization_result: Mapped[str] = mapped_column(String(8), default="none")
    authorization_reason: Mapped[str | None] = mapped_column(String(128), nullable=True)
    output_filter: Mapped[str | None] = mapped_column(String(64), nullable=True)
    guardrail_events: Mapped[list] = mapped_column(JSONB, default=list)  # [{stage, rule_id, severity, action, detail}]
    blocked_by: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    tainted: Mapped[bool] = mapped_column(Boolean, default=False)
    guardrails_degraded: Mapped[bool] = mapped_column(Boolean, default=False)
    llm_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    llm_model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    llm_raw_response: Mapped[list] = mapped_column(JSONB, default=list)
    final_response: Mapped[str] = mapped_column(Text, default="")
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=text("clock_timestamp()"), index=True)


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    jti: Mapped[str] = mapped_column(String(64), primary_key=True)
    revoked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=text("now()"))
