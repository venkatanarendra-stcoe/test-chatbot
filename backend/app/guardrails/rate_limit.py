"""§5.4.2a: in-memory per-user rate limit and lockout after repeated blocked requests. Keys are user ids (str)."""
import threading
import time
from collections import defaultdict, deque

from app.config import get_settings


class Limiter:
    def __init__(self):
        self._lock = threading.Lock()
        self.reset()

    def reset(self):
        with self._lock:
            self._requests: dict[str, deque] = defaultdict(deque)
            self._blocks: dict[str, deque] = defaultdict(deque)
            self._locked_until: dict[str, float] = {}

    def locked(self, user_id) -> bool:
        if not get_settings().lockout_enabled:
            return False
        key = str(user_id)
        with self._lock:
            until = self._locked_until.get(key)
            if until and until > time.monotonic():
                return True
            self._locked_until.pop(key, None)
            return False

    def allow_request(self, user_id) -> bool:
        """Records the request and returns False once the per-minute budget is spent."""
        now, limit, key = time.monotonic(), get_settings().rate_limit_per_minute, str(user_id)
        with self._lock:
            q = self._requests[key]
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True

    def record_block(self, user_id) -> bool:
        """Counts a blocked request; returns True if this triggered a lockout."""
        s = get_settings()
        if not s.lockout_enabled:
            return False
        now, key = time.monotonic(), str(user_id)
        with self._lock:
            q = self._blocks[key]
            q.append(now)
            while q and now - q[0] > s.lockout_window_minutes * 60:
                q.popleft()
            if len(q) >= s.lockout_threshold:
                self._locked_until[key] = now + s.lockout_duration_minutes * 60
                q.clear()
                return True
            return False

    def active(self) -> dict[str, int]:
        now = time.monotonic()
        with self._lock:
            return {k: int(v - now) for k, v in self._locked_until.items() if v > now}

    def clear(self, user_id) -> None:
        key = str(user_id)
        with self._lock:
            self._locked_until.pop(key, None)
            self._blocks.pop(key, None)


limiter = Limiter()
