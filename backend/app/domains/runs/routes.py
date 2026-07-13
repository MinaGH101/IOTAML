from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, load_only

from app.config import get_settings
from app.database import get_db
from app.domains.runs.models import Run
from app.schemas import RunCreate, RunOut, RunSummaryOut
from app.domains.runs.service import (
    TERMINAL_STATUSES, append_log, enqueue_run, enforce_run_quotas, find_idempotent_run,
    get_current_user, initial_node_statuses, progress_payload, queue_metrics, queue_retry,
    request_cancel, utcnow, validate_workflow_graph,
)

router = APIRouter(prefix='/runs', tags=['runs'])


def _owned_run(db: Session, run_id: int, username: str) -> Run:
    run = db.get(Run, run_id)
    if not run or run.owner_username != username:
        raise HTTPException(status_code=404, detail='Run not found.')
    return run


@router.post('', response_model=RunOut)
def create_run(
    payload: RunCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    idempotency_header: str | None = Header(default=None, alias='Idempotency-Key'),
) -> Run:
    settings = get_settings()
    username = str(current_user['username'])
    idempotency_key = (idempotency_header or payload.idempotency_key or '').strip() or None
    existing = find_idempotent_run(db, owner_username=username, idempotency_key=idempotency_key)
    if existing:
        return existing

    graph = payload.workflow_graph or {}
    graph_size = len(json.dumps(graph, ensure_ascii=False, default=str).encode('utf-8'))
    if graph_size > settings.max_workflow_payload_bytes:
        raise HTTPException(status_code=413, detail='Workflow payload is too large.')
    nodes = graph.get('nodes') or []
    if len(nodes) > settings.max_workflow_nodes:
        raise HTTPException(status_code=400, detail=f'Workflow exceeds the {settings.max_workflow_nodes}-node limit.')

    validation = validate_workflow_graph(graph)
    if not validation.valid:
        raise HTTPException(status_code=400, detail='; '.join(error.message for error in validation.errors))

    try:
        enforce_run_quotas(db, owner_username=username, project_id=payload.project_id)
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc

    node_statuses = initial_node_statuses(graph)
    run = Run(
        workflow_name=payload.workflow_name,
        workflow_graph=graph,
        dataset_id=payload.dataset_id,
        project_id=payload.project_id,
        owner_username=username,
        target_column=payload.target_column,
        task_type=payload.task_type,
        priority=payload.priority,
        max_attempts=payload.max_attempts or settings.job_default_max_attempts,
        timeout_seconds=payload.timeout_seconds or settings.job_default_timeout_seconds,
        idempotency_key=idempotency_key,
        status='queued',
        queued_at=utcnow(),
        node_statuses=node_statuses,
        progress=progress_payload(graph, node_statuses),
        logs=[
            {'timestamp': utcnow().isoformat() + 'Z', 'level': 'info', 'message': 'Run created and queued.', 'context': {}},
            *[
                {
                    'timestamp': utcnow().isoformat() + 'Z',
                    'level': 'warning',
                    'message': warning.message,
                    'context': {'type': warning.type, 'node_id': warning.nodeId, 'edge_id': warning.edgeId},
                }
                for warning in validation.warnings
            ],
        ],
    )
    db.add(run)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        existing = find_idempotent_run(db, owner_username=username, idempotency_key=idempotency_key)
        if existing:
            return existing
        raise HTTPException(status_code=409, detail='A conflicting run already exists.') from exc
    db.refresh(run)
    enqueue_run(run.id)
    return run


@router.get('', response_model=list[RunSummaryOut])
def list_runs(
    project_id: int | None = None,
    status: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> list[Run]:
    query = db.query(Run).options(load_only(
        Run.id,
        Run.status,
        Run.workflow_name,
        Run.project_id,
        Run.attempts,
        Run.max_attempts,
        Run.cancel_requested,
        Run.progress,
        Run.error,
        Run.created_at,
        Run.queued_at,
        Run.started_at,
        Run.finished_at,
    )).filter(Run.owner_username == str(current_user['username']))
    if project_id is not None:
        query = query.filter(Run.project_id == project_id)
    if status:
        query = query.filter(Run.status == status)
    return query.order_by(Run.created_at.desc()).limit(min(max(limit, 1), 200)).all()


@router.get('/queue/health')
def get_queue_health(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    del current_user
    return queue_metrics(db)


@router.get('/{run_id}', response_model=RunOut)
def get_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Run:
    return _owned_run(db, run_id, str(current_user['username']))


@router.get('/{run_id}/progress')
def get_run_progress(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    username = str(current_user['username'])
    run = db.query(Run).options(load_only(
        Run.id,
        Run.owner_username,
        Run.status,
        Run.attempts,
        Run.max_attempts,
        Run.cancel_requested,
        Run.heartbeat_at,
        Run.started_at,
        Run.finished_at,
        Run.error,
        Run.progress,
        Run.node_statuses,
    )).filter(Run.id == run_id, Run.owner_username == username).first()
    if not run:
        raise HTTPException(status_code=404, detail='Run not found.')
    return {
        'run_id': run.id,
        'status': run.status,
        'attempts': run.attempts,
        'max_attempts': run.max_attempts,
        'cancel_requested': run.cancel_requested,
        'heartbeat_at': run.heartbeat_at,
        'started_at': run.started_at,
        'finished_at': run.finished_at,
        'error': run.error,
        'progress': run.progress or {},
        'node_statuses': run.node_statuses or {},
    }


@router.get('/{run_id}/logs')
def get_run_logs(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    run = _owned_run(db, run_id, str(current_user['username']))
    return {'run_id': run.id, 'status': run.status, 'logs': run.logs or []}


@router.get('/{run_id}/nodes/{node_id}/preview')
def get_node_preview(
    run_id: int,
    node_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    run = _owned_run(db, run_id, str(current_user['username']))
    output = ((run.artifacts or {}).get('node_outputs') or {}).get(node_id)
    if not output:
        raise HTTPException(status_code=404, detail='Node result not found.')
    return output


@router.post('/{run_id}/cancel', response_model=RunOut)
def cancel_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Run:
    run = _owned_run(db, run_id, str(current_user['username']))
    request_cancel(db, run)
    db.commit()
    db.refresh(run)
    enqueue_run(run.id)
    return run


@router.post('/{run_id}/retry', response_model=RunOut)
def retry_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Run:
    run = _owned_run(db, run_id, str(current_user['username']))
    if run.status not in TERMINAL_STATUSES:
        raise HTTPException(status_code=409, detail='Only completed runs can be retried.')
    try:
        enforce_run_quotas(db, owner_username=run.owner_username, project_id=run.project_id)
        queue_retry(db, run, reset_attempts=True)
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    run.logs = append_log(run.logs, 'info', 'Manual retry requested.')
    db.commit()
    db.refresh(run)
    enqueue_run(run.id)
    return run
