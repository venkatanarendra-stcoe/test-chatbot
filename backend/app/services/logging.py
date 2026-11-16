"""One agent_logs row per chat request, mirrored as a JSON line to stdout and logs/agent.jsonl.
Never logs passwords, full JWTs, the PAN or connection strings (the user's message is redacted before it reaches here)."""
import json
import sys
import threading
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.db import AgentLog
from app.repositories.logs import log_to_dict

_lock = threading.Lock()


def write_agent_log(db: Session, **fields) -> AgentLog:
    row = AgentLog(**fields)
    db.add(row)
    db.commit()
    line = json.dumps(log_to_dict(row, full=False), default=str)
    with _lock:
        print(line, file=sys.stdout, flush=True)
        try:
            d = Path(get_settings().log_dir)
            d.mkdir(parents=True, exist_ok=True)
            with open(d / "agent.jsonl", "a", encoding="utf-8") as fh:
                fh.write(line + "\n")
        except OSError:
            pass
    return row
