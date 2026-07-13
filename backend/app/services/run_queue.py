from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Run
from app.services.run_state import ACTIVE_STATUSES, TERMINAL_STATUSES, append_log, initial_node_statuses, progress_payload, utcnow


def retry_delay_seconds(attempts: int) -> int:
    settings = get_settings()
    return min(settings.job_retry_max_delay_seconds, settings.job_retry_base_delay_seconds * (2 ** max(0, attempts - 1)))


def active_run_count(db: Session, *, owner_username: str | None = None, project_id: int | None = None) -> int:
    query = select(func.count(Run.id)).where(Run.status.in_(ACTIVE_STATUSES))
    if owner_username is not None:
        query = query.where(Run.owner_username == owner_username)
    if project_id is not None:
        query = query.where(Run.project_id == project_id)
    return int(db.execute(query).scalar_one())


def enforce_run_quotas(db: Session, *, owner_username: str, project_id: int | None) -> None:
    settings = get_settings()
    if active_run_count(db, owner_username=owner_username) >= settings.max_active_runs_per_user:
        raise ValueError(f'Active run limit reached ({settings.max_active_runs_per_user} per user).')
    if project_id is not None and active_run_count(db, project_id=project_id) >= settings.max_active_runs_per_project:
        raise ValueError(f'Active run limit reached ({settings.max_active_runs_per_project} per project).')


def find_idempotent_run(db: Session, *, owner_username: str, idempotency_key: str | None) -> Run | None:
    if not idempotency_key:
        return None
    return db.execute(
        select(Run)
        .where(Run.owner_username == owner_username, Run.idempotency_key == idempotency_key)
        .order_by(Run.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def claim_next_run(db: Session, worker_id: str) -> Run | None:
    now = utcnow()
    stmt = (
        select(Run)
        .where(
            Run.status == 'queued',
            Run.cancel_requested.is_(False),
            or_(Run.next_attempt_at.is_(None), Run.next_attempt_at <= now),
        )
        .order_by(Run.priority.desc(), Run.created_at.asc())
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    run = db.execute(stmt).scalar_one_or_none()
    if run is None:
        return None

    run.status = 'running'
    run.attempts = int(run.attempts or 0) + 1
    run.locked_by = worker_id
    run.locked_at = now
    run.heartbeat_at = now
    run.started_at = now
    run.finished_at = None
    run.error = None
    run.process_pid = None
    run.worker_exit_code = None
    run.logs = append_log(run.logs, 'info', 'Run claimed by worker.', worker_id=worker_id, attempt=run.attempts)
    db.flush()
    return run


def request_cancel(db: Session, run: Run) -> Run:
    if run.status in TERMINAL_STATUSES:
        return run
    run.cancel_requested = True
    run.logs = append_log(run.logs, 'warning', 'Cancellation requested by user.')
    if run.status == 'queued':
        run.status = 'cancelled'
        run.finished_at = utcnow()
        run.error = 'Cancelled by user before execution.'
        run.locked_by = None
        run.locked_at = None
        run.heartbeat_at = None
    db.flush()
    return run


def queue_retry(db: Session, run: Run, *, reset_attempts: bool = False) -> Run:
    now = utcnow()
    if run.status not in TERMINAL_STATUSES:
        raise ValueError('Only completed runs can be retried.')
    if reset_attempts:
        run.attempts = 0
    run.status = 'queued'
    run.cancel_requested = False
    run.next_attempt_at = now
    run.queued_at = now
    run.started_at = None
    run.finished_at = None
    run.locked_by = None
    run.locked_at = None
    run.heartbeat_at = None
    run.process_pid = None
    run.worker_exit_code = None
    run.error = None
    run.metrics = None
    run.artifacts = None
    run.node_statuses = initial_node_statuses(run.workflow_graph or {})
    run.progress = progress_payload(run.workflow_graph or {}, run.node_statuses)
    run.logs = append_log(run.logs, 'info', 'Run queued for retry.', attempts=run.attempts)
    db.flush()
    return run


def fail_or_requeue(db: Session, run: Run, *, error: str, status: str = 'failed') -> Run:
    now = utcnow()
    can_retry = (
        status == 'failed'
        and not run.cancel_requested
        and int(run.attempts or 0) < int(run.max_attempts or 1)
    )
    if can_retry:
        delay = retry_delay_seconds(int(run.attempts or 1))
        run.status = 'queued'
        run.next_attempt_at = now + timedelta(seconds=delay)
        run.started_at = None
        run.finished_at = None
        run.node_statuses = initial_node_statuses(run.workflow_graph or {})
        run.progress = progress_payload(run.workflow_graph or {}, run.node_statuses)
        run.error = error
        run.logs = append_log(run.logs, 'warning', 'Run failed and was requeued.', delay_seconds=delay, error=error)
    else:
        run.status = 'cancelled' if run.cancel_requested else status
        run.finished_at = now
        run.error = error
        run.logs = append_log(run.logs, 'error' if run.status == 'failed' else 'warning', f'Run finished with status {run.status}.', error=error)
    run.locked_by = None
    run.locked_at = None
    run.heartbeat_at = None
    run.process_pid = None
    db.flush()
    return run


def recover_stale_runs(db: Session) -> list[int]:
    settings = get_settings()
    now = utcnow()
    stale_before = now - timedelta(seconds=settings.job_stale_after_seconds)
    stale = db.execute(
        select(Run).where(
            Run.status == 'running',
            or_(Run.heartbeat_at.is_(None), Run.heartbeat_at < stale_before),
        ).with_for_update(skip_locked=True)
    ).scalars().all()
    recovered: list[int] = []
    for run in stale:
        fail_or_requeue(db, run, error='Worker heartbeat expired; run recovered from an abandoned worker.')
        recovered.append(run.id)
    return recovered


def queue_metrics(db: Session) -> dict[str, Any]:
    counts = dict(db.execute(select(Run.status, func.count(Run.id)).group_by(Run.status)).all())
    running = db.execute(select(Run).where(Run.status == 'running')).scalars().all()
    now = utcnow()
    return {
        'status_counts': {str(key): int(value) for key, value in counts.items()},
        'active_workers': len({run.locked_by for run in running if run.locked_by}),
        'stale_running': sum(1 for run in running if not run.heartbeat_at or (now - run.heartbeat_at).total_seconds() > get_settings().job_stale_after_seconds),
    }
