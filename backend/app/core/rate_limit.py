"""Replaceable fixed-window throttling for sensitive HTTP actions.

Redis is used when available so limits are shared by API processes. A bounded
in-process fallback keeps development usable without making Redis the durable
source of truth.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request

from app.core.config import get_settings

_LOCK = threading.Lock()
_LOCAL: dict[str, deque[float]] = defaultdict(deque)
_MAX_LOCAL_KEYS = 10_000


def _client_key(request: Request, scope: str) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    address = forwarded or (request.client.host if request.client else "unknown")
    return f"rate:{scope}:{address[:128]}"


def _local_allow(key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    now = time.monotonic()
    cutoff = now - window_seconds
    with _LOCK:
        if len(_LOCAL) > _MAX_LOCAL_KEYS and key not in _LOCAL:
            for stale_key in list(_LOCAL)[: len(_LOCAL) // 4]:
                if not _LOCAL[stale_key] or _LOCAL[stale_key][-1] < cutoff:
                    _LOCAL.pop(stale_key, None)
        entries = _LOCAL[key]
        while entries and entries[0] < cutoff:
            entries.popleft()
        if len(entries) >= limit:
            retry_after = max(1, int(window_seconds - (now - entries[0])))
            return False, retry_after
        entries.append(now)
        return True, 0


def _redis_allow(key: str, limit: int, window_seconds: int) -> tuple[bool, int] | None:
    try:
        import redis

        client = redis.Redis.from_url(
            get_settings().redis_url,
            socket_connect_timeout=get_settings().redis_connect_timeout_seconds,
            socket_timeout=get_settings().redis_connect_timeout_seconds,
            decode_responses=True,
        )
        count = int(client.incr(key))
        if count == 1:
            client.expire(key, window_seconds)
        ttl = max(1, int(client.ttl(key)))
        return count <= limit, ttl
    except Exception:
        return None


def rate_limit(scope: str, *, limit: int, window_seconds: int = 60) -> Callable[[Request], None]:
    """Return a FastAPI dependency enforcing a scoped request limit."""

    def dependency(request: Request) -> None:
        key = _client_key(request, scope)
        decision = _redis_allow(key, limit, window_seconds)
        allowed, retry_after = decision if decision is not None else _local_allow(key, limit, window_seconds)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Too many {scope.replace('_', ' ')} requests. Try again later.",
                headers={"Retry-After": str(retry_after)},
            )

    return dependency
