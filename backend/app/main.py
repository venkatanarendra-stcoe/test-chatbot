import sys
from pathlib import Path

# Allow `python main.py` from inside app/ as well as `python -m app.main` from backend/.
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import uvicorn
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import admin, auth, chat, claims, conversations, dashboard, faq, health, me, payments, policies
from app.config import get_settings
from app.realtime import SOCKET_PATH, asgi_app as socket_app
from app.llm import get_llm

settings = get_settings()
log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.guardrails_degraded:
        log.warning("GUARDRAILS DEGRADED: input=%s tool=%s output=%s", settings.guardrails_input, settings.guardrails_tool, settings.guardrails_output)
    llm = get_llm()
    log.info("LLM provider: %s", settings.llm_provider)
    if hasattr(llm, "startup_check"):
        try:
            llm.startup_check()  # warns (never fails) if Ollama or the model is missing
        except Exception:  # noqa: BLE001
            log.warning("LLM startup check failed")
    yield


app = FastAPI(title="Insurance Portal API", debug=settings.debug, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Request-ID"])


@app.exception_handler(Exception)
async def _unhandled(_: Request, exc: Exception):
    log.exception("unhandled error")
    return JSONResponse({"detail": "Internal server error"}, status_code=500)


for r in (health.router, auth.router, me.router, dashboard.router, policies.router, claims.router, payments.router, faq.router,
          chat.router, conversations.router, admin.router):
    app.include_router(r)


app.mount(SOCKET_PATH, socket_app)  # Socket.IO chat transport at /ws/socket.io


def run() -> None:
    """`python -m app.main` starts the API; HOST, PORT and RELOAD come from backend/.env."""
    cfg = get_settings()
    uvicorn.run("app.main:app", host=cfg.host, port=cfg.port, reload=cfg.reload, server_header=False,
                app_dir=str(Path(__file__).resolve().parents[1]))


if __name__ == "__main__":
    run()
