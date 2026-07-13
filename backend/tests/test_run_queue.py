from __future__ import annotations

from datetime import timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import Run
from app.services.run_queue import claim_next_run, fail_or_requeue, recover_stale_runs, request_cancel
from app.services.run_state import initial_node_statuses, progress_payload, utcnow


def make_session() -> Session:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    return Session(engine)


def make_run(**overrides) -> Run:
    graph = {'nodes': [{'id': 'node-1', 'data': {'label': 'Node 1'}}], 'edges': []}
    statuses = initial_node_statuses(graph)
    values = {
        'workflow_name': 'Test',
        'workflow_graph': graph,
        'owner_username': 'admin',
        'status': 'queued',
        'queued_at': utcnow(),
        'node_statuses': statuses,
        'progress': progress_payload(graph, statuses),
        'max_attempts': 3,
        'timeout_seconds': 60,
    }
    values.update(overrides)
    return Run(**values)


def test_atomic_claim_prevents_second_claim() -> None:
    with make_session() as db:
        db.add(make_run())
        db.commit()
        with db.begin():
            first = claim_next_run(db, 'worker-a')
        with db.begin():
            second = claim_next_run(db, 'worker-b')
        assert first is not None
        assert first.status == 'running'
        assert first.locked_by == 'worker-a'
        assert first.attempts == 1
        assert second is None


def test_cancel_queued_run_becomes_cancelled() -> None:
    with make_session() as db:
        run = make_run()
        db.add(run)
        db.commit()
        request_cancel(db, run)
        db.commit()
        assert run.status == 'cancelled'
        assert run.cancel_requested is True
        assert run.finished_at is not None


def test_failure_requeues_with_backoff_until_attempt_limit() -> None:
    with make_session() as db:
        run = make_run(status='running', attempts=1, max_attempts=2, locked_by='worker-a')
        db.add(run)
        db.commit()
        fail_or_requeue(db, run, error='boom')
        db.commit()
        assert run.status == 'queued'
        assert run.next_attempt_at is not None
        run.status = 'running'
        run.attempts = 2
        fail_or_requeue(db, run, error='boom again')
        db.commit()
        assert run.status == 'failed'
        assert run.finished_at is not None


def test_stale_worker_run_is_recovered() -> None:
    with make_session() as db:
        run = make_run(
            status='running',
            attempts=1,
            max_attempts=2,
            locked_by='dead-worker',
            heartbeat_at=utcnow() - timedelta(hours=1),
        )
        db.add(run)
        db.commit()
        recovered = recover_stale_runs(db)
        db.commit()
        assert recovered == [run.id]
        assert run.status == 'queued'
        assert run.locked_by is None
