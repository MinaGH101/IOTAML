"""Run-management HTTP API routes.

This module exposes the FastAPI endpoints used to create and inspect workflow
runs, check queue health, retrieve node execution details, cancel an active
run, and retry a terminal run.

Main responsibilities
---------------------
1. Authenticate the current user through FastAPI dependencies.
2. Ensure users can access only their own runs and related resources.
3. Validate workflow, project, dataset, payload-size, and revision rules.
4. Normalize the submitted workflow graph and build its execution plan.
5. Create and persist queued ``Run`` records.
6. Send persisted runs to the execution queue.
7. Return run state, progress, logs, previews, and node-execution metadata.
8. Register cancellation and retry requests.

This file is an HTTP/controller layer. It coordinates models and services, but
it does not execute workflow nodes itself. Execution and queue operations are
delegated to functions imported from ``app.domains.runs.service`` and the
workflow planning modules.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, load_only

from app.core.config import get_settings
from app.core.errors import ValidationAppError
from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.domains.runs.models import Run
from app.domains.artifacts.models import NodeExecution
from app.domains.auth.models import ROLE_ADMIN, ROLE_MANAGER, User
from app.domains.auth.service import get_current_user_model, normalize_role
from app.domains.workflows.models import Workflow
from app.domains.projects.access import require_project_run, require_project_view
from app.domains.projects.models import Project, ProjectAssignment
from app.domains.datasets.models import Dataset
from app.domains.runs.schemas import RunCreate, RunOut, RunSummaryOut
from app.workflow.compatibility import normalize_graph
from app.workflow.planning import build_execution_plan
from app.domains.runs.service import (
    TERMINAL_STATUSES, append_log, enqueue_run, enforce_run_quotas, find_idempotent_run,
    initial_node_statuses, progress_payload, queue_retry,
    request_cancel, utcnow, validate_workflow_graph,
)


# All endpoints in this module are mounted under /runs and grouped as "runs"
# in the generated OpenAPI/Swagger documentation.
router = APIRouter(prefix='/runs', tags=['runs'])


# -----------------------------------------------------------------------------
# Internal authorization helpers
# -----------------------------------------------------------------------------

def _accessible_project_ids(db: Session, user: User):
    role = normalize_role(user.role)
    statement = select(Project.id)
    if role not in {ROLE_ADMIN, ROLE_MANAGER}:
        assigned = select(ProjectAssignment.project_id).where(ProjectAssignment.user_id == user.id)
        statement = statement.where(
            or_(func.lower(Project.owner_username) == user.username.lower(), Project.id.in_(assigned))
        )
    return statement


def _run_access_filter(db: Session, user: User):
    role = normalize_role(user.role)
    if role in {ROLE_ADMIN, ROLE_MANAGER}:
        return or_(Run.project_id.is_not(None), func.lower(Run.owner_username) == user.username.lower())
    return or_(
        Run.project_id.in_(_accessible_project_ids(db, user)),
        (Run.project_id.is_(None)) & (func.lower(Run.owner_username) == user.username.lower()),
    )


def _authorized_run(db: Session, run_id: int, user: User, *, write: bool = False) -> Run:
    run = db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail='Run not found.')
    if run.project_id is None:
        if run.owner_username.lower() != user.username.lower():
            raise HTTPException(status_code=404, detail='Run not found.')
    elif write:
        require_project_run(db, run.project_id, user)
    else:
        require_project_view(db, run.project_id, user)
    return run

# -----------------------------------------------------------------------------
# Run creation
# -----------------------------------------------------------------------------

@router.post('', response_model=RunOut)
def create_run(
    payload: RunCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_model),
    idempotency_header: str | None = Header(default=None, alias='Idempotency-Key'),
    _: None = Depends(rate_limit('run_creation', limit=get_settings().run_rate_limit_per_minute)),
) -> Run:
    """Validate, persist, and enqueue a new workflow run.

    HTTP endpoint:
        ``POST /runs``

    The endpoint performs the complete pre-execution preparation flow:

    1. Resolves the authenticated username and idempotency key.
    2. Returns an existing matching run when the request is idempotent.
    3. Validates workflow ownership, project consistency, and revision state.
    4. Validates project and dataset ownership and relationships.
    5. Enforces workflow payload-size and node-count limits.
    6. Normalizes the graph and builds the selected execution plan.
    7. Runs structural workflow validation.
    8. Enforces per-user/project run quotas.
    9. Creates the initial node statuses, progress data, and run logs.
    10. Commits the ``Run`` record and sends its ID to the queue.

    Args:
        payload: Parsed ``RunCreate`` request body. It may include the workflow
            graph, related workflow/project/dataset IDs, selected node ID,
            retry/timeout settings, priority, cache behavior, and an optional
            body-level idempotency key.
        db: Active SQLAlchemy database session injected by FastAPI.
        current_user: Authenticated user data returned by ``get_current_user``.
            This function expects it to contain a ``username`` key.
        idempotency_header: Optional value of the HTTP ``Idempotency-Key``
            header. It takes precedence over ``payload.idempotency_key``.
        _: Result of the run-creation rate-limit dependency. The value is not
            used directly; resolving the dependency enforces the limit.

    Returns:
        A persisted ``Run`` ORM object. FastAPI serializes it using ``RunOut``.
        If an existing idempotent run is found, that existing object is returned
        instead of creating a duplicate.

    Raises:
        HTTPException: For missing resources, ownership/project mismatches,
            stale workflow revisions, oversized workflows, node-limit
            violations, quota violations, or conflicting database records.
        ValidationAppError: When execution-plan construction or workflow graph
            validation fails.
    """
    # Read application limits and queue defaults once for this request.
    settings = get_settings()

    # Normalize the authenticated username to a string before database use.
    username = current_user.username
    resource_owner = username

    # Header value has priority over the body value. Empty/whitespace-only
    # values are converted to None so they do not behave as real keys.
    idempotency_key = (idempotency_header or payload.idempotency_key or '').strip() or None

    # Repeated requests with the same owner/key return the original run.
    existing = find_idempotent_run(db, owner_username=resource_owner, idempotency_key=idempotency_key)
    if existing:
        return existing

    # ------------------------------------------------------------------
    # Validate the optional stored workflow reference and its revision.
    # ------------------------------------------------------------------
    workflow_revision = payload.workflow_revision
    if payload.workflow_id is not None:
        workflow = db.get(Workflow, payload.workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail='Workflow not found.')
        if workflow.project_id is None:
            if workflow.owner_username.lower() != username.lower():
                raise HTTPException(status_code=404, detail='Workflow not found.')
        else:
            project, _ = require_project_run(db, workflow.project_id, current_user)
            resource_owner = project.owner_username

        # A run cannot reference a workflow that belongs to another project.
        if workflow.project_id != payload.project_id:
            raise HTTPException(status_code=400, detail='Workflow and run project do not match.')

        # Reject a client draft based on an older stored workflow revision.
        if workflow_revision is not None and workflow_revision != workflow.revision:
            raise HTTPException(status_code=409, detail='Workflow revision is stale. Autosave the current draft before running.')

        # Persist the authoritative database revision with the run.
        workflow_revision = workflow.revision

    # ------------------------------------------------------------------
    # Validate optional project and dataset references.
    # ------------------------------------------------------------------
    if payload.project_id is not None:
        project, _ = require_project_run(db, payload.project_id, current_user)
        resource_owner = project.owner_username

    if payload.dataset_id is not None:
        dataset = db.get(Dataset, payload.dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail='Dataset not found.')
        if dataset.project_id is None:
            if dataset.owner_username.lower() != username.lower():
                raise HTTPException(status_code=404, detail='Dataset not found.')
        else:
            require_project_view(db, dataset.project_id, current_user)

        # A project-scoped run may use a global/unassigned dataset (project_id
        # is None) or a dataset assigned to the same project.
        if payload.project_id is not None and dataset.project_id not in {None, payload.project_id}:
            raise HTTPException(status_code=400, detail='Dataset and run project do not match.')

    # ------------------------------------------------------------------
    # Enforce graph transport/storage limits before deeper processing.
    # ------------------------------------------------------------------
    graph = payload.workflow_graph or {}

    # Serialize to UTF-8 bytes so the limit measures the actual encoded payload
    # size rather than only the number of Python characters.
    graph_size = len(json.dumps(graph, ensure_ascii=False, default=str).encode('utf-8'))
    if graph_size > settings.max_workflow_payload_bytes:
        raise HTTPException(status_code=413, detail='Workflow payload is too large.')

    nodes = graph.get('nodes') or []
    if len(nodes) > settings.max_workflow_nodes:
        raise HTTPException(status_code=400, detail=f'Workflow exceeds the {settings.max_workflow_nodes}-node limit.')

    # ------------------------------------------------------------------
    # Convert the submitted graph into the canonical executable plan.
    # ------------------------------------------------------------------
    try:
        # Compatibility normalization converts accepted client graph variants
        # into the canonical structure expected by the planner.
        canonical_graph = normalize_graph(graph)

        # When selected_node_id is supplied, the planner determines the target
        # node and the upstream graph required to execute it.
        execution_plan = build_execution_plan(canonical_graph, payload.selected_node_id)
    except ValueError as exc:
        # Translate planner/normalization errors into the application's
        # structured validation-error format.
        raise ValidationAppError('WORKFLOW_PLAN_INVALID', str(exc), {}) from exc

    # Validate the graph that will actually execute, not merely the original
    # submitted graph. This matters for selected-node execution plans.
    validation = validate_workflow_graph(execution_plan.graph)
    if not validation.valid:
        raise ValidationAppError(
            "WORKFLOW_VALIDATION_FAILED",
            "Workflow validation failed.",
            {"errors": [error.model_dump() for error in validation.errors]},
        )

    # ------------------------------------------------------------------
    # Reject new work when configured owner/project quotas are exceeded.
    # ------------------------------------------------------------------
    try:
        enforce_run_quotas(db, owner_username=resource_owner, project_id=payload.project_id)
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc

    # Build the initial per-node status map and aggregate progress object before
    # the run is inserted. This lets clients immediately display queued nodes.
    node_statuses = initial_node_statuses(execution_plan.graph)

    # ------------------------------------------------------------------
    # Create the durable queue record.
    # ------------------------------------------------------------------
    run = Run(
        workflow_name=payload.workflow_name,
        workflow_graph=graph,
        workflow_id=payload.workflow_id,
        workflow_revision=workflow_revision,
        dataset_id=payload.dataset_id,
        project_id=payload.project_id,
        owner_username=resource_owner,
        target_column=payload.target_column,
        task_type=payload.task_type,
        selected_node_id=payload.selected_node_id,
        bypass_cache=payload.bypass_cache,
        priority=payload.priority,
        max_attempts=payload.max_attempts or settings.job_default_max_attempts,
        timeout_seconds=payload.timeout_seconds or settings.job_default_timeout_seconds,
        idempotency_key=idempotency_key,
        status='queued',
        queued_at=utcnow(),
        node_statuses=node_statuses,
        progress=progress_payload(execution_plan.graph, node_statuses),
        logs=[
            # Every new run begins with a creation/queue log entry.
            {'timestamp': utcnow().isoformat() + 'Z', 'level': 'info', 'message': 'Run created and queued.', 'context': {}},
            # Non-blocking validation warnings are preserved in the run log so
            # the frontend can show them without rejecting execution.
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

    # Commit before enqueueing so the worker can load a durable database row.
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()

        # A concurrent request may have inserted the same idempotency key after
        # the earlier lookup. Return that row when available.
        existing = find_idempotent_run(db, owner_username=resource_owner, idempotency_key=idempotency_key)
        if existing:
            return existing

        raise HTTPException(status_code=409, detail='A conflicting run already exists.') from exc

    # Refresh database-generated fields such as the primary-key ID.
    db.refresh(run)

    # Queue only the persisted run ID; the worker retrieves the full record.
    enqueue_run(run.id)

    return run


# -----------------------------------------------------------------------------
# Run listing and queue status
# -----------------------------------------------------------------------------

@router.get('', response_model=list[RunSummaryOut])
def list_runs(
    project_id: int | None = None,
    status: str | None = None,
    limit: int = Query(default=50, ge=1),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_model),
) -> list[Run]:
    """Return a paginated list of runs owned by the current user.

    HTTP endpoint:
        ``GET /runs``

    Only summary fields needed by run-history/list views are loaded. This avoids
    retrieving larger fields such as complete workflow graphs, logs, artifacts,
    and node status details for every row.

    Args:
        project_id: Optional project filter. When provided, only runs linked to
            this project ID are returned.
        status: Optional exact run-status filter, such as ``queued``, ``running``,
            ``completed``, ``failed``, or another status supported by the model.
        limit: Requested page size. It must be at least 1 and is capped by
            ``api_max_page_size``.
        offset: Number of ordered records to skip. It must be zero or greater.
        db: Active SQLAlchemy database session.
        current_user: Authenticated user dictionary containing ``username``.

    Returns:
        Run ORM objects ordered newest first. FastAPI serializes each object with
        ``RunSummaryOut``.
    """
    # ``load_only`` prevents large run columns from being selected for a summary
    # list request.
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
    )).filter(_run_access_filter(db, current_user))

    # Apply filters only when the caller supplied them.
    if project_id is not None:
        require_project_view(db, project_id, current_user)
        query = query.filter(Run.project_id == project_id)
    if status:
        query = query.filter(Run.status == status)

    # Use created_at and ID descending for deterministic newest-first ordering.
    # The configured API maximum protects the endpoint from oversized pages.
    return query.order_by(Run.created_at.desc(), Run.id.desc()).offset(offset).limit(min(limit, get_settings().api_max_page_size)).all()


@router.get('/queue/health')
def get_queue_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_model),
) -> dict:
    """Return queue metrics scoped to the authenticated user.

    HTTP endpoint:
        ``GET /runs/queue/health``

    Args:
        db: Active SQLAlchemy database session.
        current_user: Authenticated user dictionary containing ``username``.

    Returns:
        A dictionary produced by ``queue_metrics``. The exact metric fields are
        defined by that service function, not by this route.
    """
    access_filter = _run_access_filter(db, current_user)
    counts = dict(db.execute(select(Run.status, func.count(Run.id)).where(access_filter).group_by(Run.status)).all())
    return {'status_counts': {str(key): int(value) for key, value in counts.items()}}


# -----------------------------------------------------------------------------
# Run inspection endpoints
# -----------------------------------------------------------------------------

@router.get('/{run_id}/node-executions')
def get_node_executions(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_model),
) -> list[dict]:
    """Return execution records for every node processed in a run.

    HTTP endpoint:
        ``GET /runs/{run_id}/node-executions``

    Args:
        run_id: ID of the parent run.
        db: Active SQLAlchemy database session.
        current_user: Authenticated user dictionary containing ``username``.

    Returns:
        A list of dictionaries ordered by ``NodeExecution.id`` ascending. Each
        dictionary contains node identity, status, cache information, artifact
        references, duration, output digest, and error information.

    Raises:
        HTTPException: With status 404 when the run is missing or not owned by
        the current user.
    """
    # Verify parent-run ownership before exposing its node-level records.
    run = _authorized_run(db, run_id, current_user)

    # Ascending IDs preserve the order in which execution records were stored.
    records = db.query(NodeExecution).filter(NodeExecution.run_id == run.id).order_by(NodeExecution.id.asc()).all()

    # Convert ORM rows into the intentionally limited public response shape.
    return [{
        'node_id': record.node_id,
        'node_type': record.node_type,
        'status': record.status,
        'cache_hit': record.cache_hit,
        'cache_key': record.cache_key,
        'artifact_id': record.artifact_id,
        'source_run_id': (record.metadata_json or {}).get('source_run_id'),
        'duration_ms': record.duration_ms,
        'output_digest': record.output_digest,
        'error': record.error,
    } for record in records]


@router.get('/{run_id}', response_model=RunOut)
def get_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_model),
) -> Run:
    """Return the complete API representation of one owned run.

    HTTP endpoint:
        ``GET /runs/{run_id}``

    Args:
        run_id: Primary-key ID of the requested run.
        db: Active SQLAlchemy database session.
        current_user: Authenticated user dictionary containing ``username``.

    Returns:
        The owned ``Run`` ORM object, serialized by FastAPI as ``RunOut``.

    Raises:
        HTTPException: With status 404 when the run is missing or not owned by
        the current user.
    """
    return _authorized_run(db, run_id, current_user)


@router.get('/{run_id}/progress')
def get_run_progress(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_model),
) -> dict:
    """Return lightweight status and progress data for a run.

    HTTP endpoint:
        ``GET /runs/{run_id}/progress``

    This endpoint is suitable for repeated frontend polling because it selects
    only the columns required to display execution state instead of loading the
    complete run record.

    Args:
        run_id: Primary-key ID of the requested run.
        db: Active SQLAlchemy database session.
        current_user: Authenticated user dictionary containing ``username``.

    Returns:
        A dictionary containing the run ID, overall status, retry counters,
        cancellation flag, heartbeat/start/finish timestamps, error data,
        aggregate progress, and per-node statuses.

    Raises:
        HTTPException: With status 404 when the run is missing or not owned by
        the current user.
    """
    # Select only frequently polled state columns to reduce database transfer and
    # ORM object materialization cost.
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
    )).filter(Run.id == run_id, _run_access_filter(db, current_user)).first()

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
        # Return empty objects rather than null for easier frontend consumption.
        'progress': run.progress or {},
        'node_statuses': run.node_statuses or {},
    }


@router.get('/{run_id}/logs')
def get_run_logs(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_model),
) -> dict:
    """Return the stored log entries for one owned run.

    HTTP endpoint:
        ``GET /runs/{run_id}/logs``

    Args:
        run_id: Primary-key ID of the requested run.
        db: Active SQLAlchemy database session.
        current_user: Authenticated user dictionary containing ``username``.

    Returns:
        A dictionary with ``run_id``, current ``status``, and ``logs``. An empty
        list is returned when the database value is null or otherwise falsy.

    Raises:
        HTTPException: With status 404 when the run is missing or not owned by
        the current user.
    """
    run = _authorized_run(db, run_id, current_user)
    return {'run_id': run.id, 'status': run.status, 'logs': run.logs or []}


@router.get('/{run_id}/nodes/{node_id}/preview')
def get_node_preview(
    run_id: int,
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_model),
) -> dict:
    """Return the stored output preview for one node in a run.

    HTTP endpoint:
        ``GET /runs/{run_id}/nodes/{node_id}/preview``

    The route reads the node output from the nested structure:
    ``run.artifacts['node_outputs'][node_id]``.

    Args:
        run_id: ID of the run containing the node output.
        node_id: Workflow node identifier used as the ``node_outputs`` key.
        db: Active SQLAlchemy database session.
        current_user: Authenticated user dictionary containing ``username``.

    Returns:
        The stored node-output dictionary.

    Raises:
        HTTPException: With status 404 when the run is missing/not owned or when
        no truthy output exists for the requested node ID.
    """
    run = _authorized_run(db, run_id, current_user)

    # Each ``or {}`` safely handles a missing/null artifacts object and a
    # missing/null node_outputs mapping.
    output = ((run.artifacts or {}).get('node_outputs') or {}).get(node_id)

    if not output:
        raise HTTPException(status_code=404, detail='Node result not found.')

    return output


# -----------------------------------------------------------------------------
# Run control endpoints
# -----------------------------------------------------------------------------

@router.post('/{run_id}/cancel', response_model=RunOut)
def cancel_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_model),
) -> Run:
    """Register a cancellation request for an owned run.

    HTTP endpoint:
        ``POST /runs/{run_id}/cancel``

    The service function ``request_cancel`` performs the cancellation-state
    mutation. This route persists that mutation, refreshes the ORM object, then
    calls ``enqueue_run`` with the run ID.

    Args:
        run_id: Primary-key ID of the run to cancel.
        db: Active SQLAlchemy database session.
        current_user: Authenticated user dictionary containing ``username``.

    Returns:
        The refreshed ``Run`` object serialized as ``RunOut``.

    Raises:
        HTTPException: With status 404 when the run is missing or not owned by
        the current user. Additional service-level errors may propagate from
        ``request_cancel`` or ``enqueue_run``.
    """
    run = _authorized_run(db, run_id, current_user, write=True)

    # Apply cancellation fields/status according to the run service rules.
    request_cancel(db, run)

    # Persist the cancellation request before queue notification.
    db.commit()
    db.refresh(run)

    enqueue_run(run.id)
    return run


@router.post('/{run_id}/retry', response_model=RunOut)
def retry_run(
    run_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_model),
) -> Run:
    """Reset and enqueue an owned terminal run for manual retry.

    HTTP endpoint:
        ``POST /runs/{run_id}/retry``

    A run can be manually retried only when its current status belongs to
    ``TERMINAL_STATUSES``. Before queueing, the endpoint enforces current run
    quotas, applies the retry-state mutation, resets attempts, and appends a
    manual-retry log entry.

    Args:
        run_id: Primary-key ID of the terminal run to retry.
        db: Active SQLAlchemy database session.
        current_user: Authenticated user dictionary containing ``username``.

    Returns:
        The refreshed retried ``Run`` object serialized as ``RunOut``.

    Raises:
        HTTPException: With status 404 for a missing/unowned run, status 409
            when the run is not terminal, or status 429 when run quotas reject
            the retry.
    """
    run = _authorized_run(db, run_id, current_user, write=True)

    # Active/nonterminal runs cannot be manually placed back in the queue.
    if run.status not in TERMINAL_STATUSES:
        raise HTTPException(status_code=409, detail='Only completed runs can be retried.')

    try:
        # A retry is subject to the same configured capacity constraints as a
        # newly created run.
        enforce_run_quotas(db, owner_username=run.owner_username, project_id=run.project_id)

        # Mutate the existing run into its queued retry state and restart its
        # attempt counter according to this endpoint's manual-retry behavior.
        queue_retry(db, run, reset_attempts=True)
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc

    # Preserve an explicit audit/log indication that the retry was manual.
    run.logs = append_log(run.logs, 'info', 'Manual retry requested.')

    db.commit()
    db.refresh(run)

    enqueue_run(run.id)
    return run
