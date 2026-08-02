"""Transient queue notifications; PostgreSQL remains authoritative."""
from __future__ import annotations

from app.core.config import get_settings

QUEUE_NAME = "workflow-runs"


def enqueue_run(run_id: int) -> None:
    """Best-effort worker wakeup that never affects durable queue creation."""
    try:
        from redis import Redis

        Redis.from_url(
            get_settings().redis_url,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
        ).publish(QUEUE_NAME, str(run_id))
    except Exception:
        return


def execute_run(run_id: int) -> None:
    """Compatibility one-shot runner for tests and administrative use."""
    from app.workers.reliable_worker import run_one

    run_one(run_id)
