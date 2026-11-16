from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import Principal, get_current_user
from app.db.engines import get_db
from app.repositories import conversations as repo

router = APIRouter(prefix="/api/conversations")


def _own(db: Session, p: Principal, cid: str):
    conv = repo.get_owned(db, p, cid)
    if conv is None:
        raise HTTPException(404, "Conversation not found")
    return conv


@router.get("")
def list_conversations(p: Principal = Depends(get_current_user), db: Session = Depends(get_db)):
    return repo.list_for(db, p)


@router.get("/{conversation_id}/messages")
def messages(conversation_id: str, p: Principal = Depends(get_current_user), db: Session = Depends(get_db)):
    return repo.messages_for(db, _own(db, p, conversation_id))


@router.delete("/{conversation_id}")
def delete(conversation_id: str, p: Principal = Depends(get_current_user), db: Session = Depends(get_db)):
    repo.delete_owned(db, _own(db, p, conversation_id))
    return {"status": "deleted"}
