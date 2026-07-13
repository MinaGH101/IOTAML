from __future__ import annotations

from redis import Redis

from app.config import get_settings

QUEUE_NAME = 'workflow-runs'


def enqueue_run(run_id: int) -> None:
    """Wake workers; PostgreSQL remains the authoritative queue."""
    try:
        Redis.from_url(get_settings().redis_url, socket_connect_timeout=0.5, socket_timeout=0.5).publish(QUEUE_NAME, str(run_id))
    except Exception:
        pass


def execute_run(run_id: int) -> None:
    """Compatibility one-shot runner for tests and administrative use."""
    from app.workers.reliable_worker import run_one
    run_one(run_id)
