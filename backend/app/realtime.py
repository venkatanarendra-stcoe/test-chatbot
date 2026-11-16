"""Socket.IO transport for the chat. It is only a transport: every message goes through the same handle_chat pipeline
(identity, authorization, guardrails, logging) as POST /api/chat, and the token is re-verified for every message.

Client -> server   chat:send  {message, conversation_id?}   (acknowledged with the result)
Server -> client   chat:typing {}                           when work starts
                   chat:reply  {request_id, conversation_id, reply, blocked}   to the user's OTHER connections (the sender gets the ack)
                   chat:error  {status, detail}
"""
import asyncio
import logging

import socketio
from pydantic import ValidationError

from app.agent.orchestrator import ConversationNotFound, RateLimited, handle_chat
from app.auth.dependencies import principal_from_token
from app.config import get_settings
from app.db.engines import SessionLocal
from app.schemas.requests import ChatRequest

log = logging.getLogger("uvicorn.error")
SOCKET_PATH = "/ws"  # the Socket.IO endpoint is /ws/socket.io

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=[get_settings().frontend_origin], logger=False, engineio_logger=False)
asgi_app = socketio.ASGIApp(sio, socketio_path=SOCKET_PATH.strip("/") + "/socket.io")  # Starlette keeps the mount prefix in scope["path"]


def _authenticate(token: str | None):
    """Sync helper (runs in a worker thread): the principal for this token, or None."""
    if not token or not isinstance(token, str):
        return None
    db = SessionLocal()
    try:
        return principal_from_token(db, token)
    finally:
        db.close()


def _run_chat(token: str | None, payload: object) -> dict:
    p = _authenticate(token)
    if p is None:
        return {"ok": False, "status": 401, "detail": "Not authenticated"}
    try:
        body = ChatRequest.model_validate(payload)
    except ValidationError:
        return {"ok": False, "status": 422, "detail": "Invalid message"}
    db = SessionLocal()
    try:
        r = handle_chat(db, p, body.message, body.conversation_id)
        return {"ok": True, "user_id": str(p.user_id), "request_id": r.request_id, "conversation_id": r.conversation_id, "reply": r.reply, "blocked": r.blocked}
    except ConversationNotFound:
        return {"ok": False, "status": 404, "detail": "Conversation not found"}
    except RateLimited as e:
        return {"ok": False, "status": 429, "detail": e.message}
    except Exception:  # noqa: BLE001 - never leak internals over the socket
        log.exception("socket chat failed")
        return {"ok": False, "status": 500, "detail": "Internal server error"}
    finally:
        db.close()


@sio.event
async def connect(sid, environ, auth):
    token = auth.get("token") if isinstance(auth, dict) else None
    p = await asyncio.to_thread(_authenticate, token)
    if p is None:
        raise socketio.exceptions.ConnectionRefusedError("Not authenticated")
    await sio.save_session(sid, {"token": token})
    await sio.enter_room(sid, f"user:{p.user_id}")


@sio.on("chat:send")
async def chat_send(sid, data):
    session = await sio.get_session(sid)
    await sio.emit("chat:typing", {}, to=sid)
    result = await asyncio.to_thread(_run_chat, session.get("token"), data)
    user_id = result.pop("user_id", None)
    if result["ok"]:
        # the sender gets the reply as the acknowledgement; the user's other open tabs get it as an event
        await sio.emit("chat:reply", {k: result[k] for k in ("request_id", "conversation_id", "reply", "blocked")}, room=f"user:{user_id}", skip_sid=sid)
    else:
        await sio.emit("chat:error", {"status": result["status"], "detail": result["detail"]}, to=sid)
    return result

