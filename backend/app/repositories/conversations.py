import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.agent.context import Principal
from app.models.db import Conversation, Message


def parse_id(value: str | None) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


def get_owned(db: Session, ctx: Principal, conversation_id: str | None) -> Conversation | None:
    """Another user's conversation and a non-existent / malformed id are indistinguishable (None)."""
    cid = parse_id(conversation_id)
    conv = db.get(Conversation, cid) if cid else None
    return conv if conv is not None and conv.user_id == ctx.user_id else None


def list_for(db: Session, ctx: Principal) -> list[dict]:
    rows = db.scalars(select(Conversation).where(Conversation.user_id == ctx.user_id).order_by(Conversation.updated_at.desc()))
    return [{"id": str(c.id), "title": c.title, "created_at": c.created_at.isoformat(), "updated_at": c.updated_at.isoformat()} for c in rows]


def messages_for(db: Session, conv: Conversation) -> list[dict]:
    rows = db.scalars(select(Message).where(Message.conversation_id == conv.id, Message.role != "tool").order_by(Message.created_at, Message.id))
    return [{"id": str(r.id), "role": r.role, "content": r.content, "request_id": r.request_id, "blocked": bool(r.blocked),
             "created_at": r.created_at.isoformat()} for r in rows]


def count_messages(db: Session, conv: Conversation) -> int:
    return db.scalar(select(func.count(Message.id)).where(Message.conversation_id == conv.id)) or 0


def history(db: Session, conv: Conversation, limit: int = 20) -> list[Message]:
    rows = db.scalars(select(Message).where(Message.conversation_id == conv.id, Message.role.in_(("user", "assistant")), Message.blocked.is_(False))
                      .order_by(Message.created_at.desc(), Message.id.desc()).limit(limit)).all()
    return list(reversed(rows))


def delete_owned(db: Session, conv: Conversation) -> None:
    db.execute(delete(Message).where(Message.conversation_id == conv.id))
    db.delete(conv)
    db.commit()
