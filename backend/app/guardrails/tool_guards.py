"""§5.4.4 tool guardrails (call limits, timeout, size cap, result injection scan) + spotlighting (§5.4.3).
Read-only execution is NOT a guardrail toggle: tools always run as ia_tools inside BEGIN READ ONLY with RLS (see agent/tools.py)."""
import json
import re
import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout

from app.agent.context import Principal
from app.config import get_settings
from app.guardrails.input_guards import Finding, detect_injection
from app.guardrails.normalize import build_scan

MAX_CALLS, MAX_PER_TOOL, MAX_RESULT_BYTES = 5, 2, 8 * 1024
_BOUNDARY = re.compile(r"<<\s*/?\s*(END_)?TOOL_RESULT[^>]*>>?", re.I)


class ToolTimeout(Exception):
    pass


def run_with_timeout(fn, *args):
    ex = ThreadPoolExecutor(max_workers=1)
    fut = ex.submit(fn, *args)
    try:
        return fut.result(timeout=get_settings().tool_timeout_seconds)
    except FutureTimeout as e:
        raise ToolTimeout() from e
    finally:
        ex.shutdown(wait=False)


def execute_tool_guarded(ctx: Principal, name: str, args: dict, timeout: bool = True):
    from app.agent.tools import execute_tool

    return run_with_timeout(execute_tool, ctx, name, args) if timeout else execute_tool(ctx, name, args)


def cap_size(serialized: str) -> tuple[str, bool]:
    if len(serialized.encode()) > MAX_RESULT_BYTES:
        return json.dumps({"error": "result_too_large"}), True
    return serialized, False


def scan_result(serialized: str) -> list[Finding]:
    """Injection detector over a tool result; a block-level match taints the request."""
    findings, blocked = detect_injection(build_scan(serialized))
    return [Finding("tool", "tool_result_injection", f.severity, f.rule_id, rule_id="tool_result_injection") for f in findings] if blocked else []


def spotlight(serialized: str, boundary_id: str) -> str:
    """Wrap untrusted tool data in a random per-request boundary after stripping boundary-like text."""
    body = _BOUNDARY.sub("", serialized)
    return f"<<TOOL_RESULT id={boundary_id}>>\n{body}\n<<END_TOOL_RESULT id={boundary_id}>>"


def new_boundary_id() -> str:
    return uuid.uuid4().hex[:12]


def call_key(name: str, args: dict) -> str:
    return name + json.dumps(args, sort_keys=True, default=str)
