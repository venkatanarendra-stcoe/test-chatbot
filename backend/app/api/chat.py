from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.agent.orchestrator import ConversationNotFound, RateLimited, handle_chat
from app.auth.dependencies import Principal, get_current_user
from app.db.engines import get_db
from app.schemas.requests import ChatRequest, ChatResponse

router = APIRouter(prefix="/api")


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, response: Response, p: Principal = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        result = handle_chat(db, p, body.message, body.conversation_id)
    except ConversationNotFound:
        raise HTTPException(404, "Conversation not found")
    except RateLimited as e:
        raise HTTPException(429, e.message, headers={"Retry-After": "60"})
    response.headers["X-Request-ID"] = result.request_id
    return ChatResponse(request_id=result.request_id, conversation_id=result.conversation_id, reply=result.reply, blocked=result.blocked)
