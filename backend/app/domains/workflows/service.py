from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationAppError
from app.domains.workflows.repository import workflow_repository
from app.domains.workflows.schemas import WorkflowAutosaveIn, WorkflowCreate, WorkflowVersionCreate
from app.models import Project, Run, Workflow, WorkflowVersion
from app.services.node_cache_keys import sha256_json
from app.services.run_state import utcnow
from app.workflow.validator import validate_workflow_graph


def validate_graph(graph: dict) -> dict:
    result = validate_workflow_graph(graph or {})
    return result.model_dump()


def _assert_valid(graph: dict) -> None:
    validation = validate_workflow_graph(graph)
    if not validation.valid:
        raise ValidationAppError(
            "WORKFLOW_VALIDATION_FAILED",
            "Workflow validation failed.",
            {"errors": [error.model_dump() for error in validation.errors]},
        )


def _assert_project_access(db: Session, project_id: int | None, owner_username: str) -> None:
    if project_id is None:
        return
    project = db.get(Project, project_id)
    if not project:
        raise NotFoundError("PROJECT_NOT_FOUND", "Project not found.", {"project_id": project_id})
    if project.owner_username != owner_username:
        raise PermissionDeniedError()


def _validated_last_run_id(
    db: Session,
    *,
    run_id: int | None,
    owner_username: str,
    project_id: int | None,
    workflow_id: int | None = None,
) -> int | None:
    if run_id is None:
        return None
    run = db.get(Run, run_id)
    if not run or run.owner_username != owner_username:
        raise ValidationAppError("INVALID_WORKFLOW_RUN", "The selected run is not available to this workflow.")
    if run.project_id != project_id:
        raise ValidationAppError("INVALID_WORKFLOW_RUN", "The selected run belongs to a different project.")
    if workflow_id is not None and run.workflow_id not in {None, workflow_id}:
        raise ValidationAppError("INVALID_WORKFLOW_RUN", "The selected run belongs to a different workflow.")
    if run.status != "succeeded":
        raise ValidationAppError("INVALID_WORKFLOW_RUN", "Only a successful run can be attached as workflow results.")
    return run.id


def create_workflow(db: Session, payload: WorkflowCreate, owner_username: str) -> Workflow:
    _assert_valid(payload.graph)
    _assert_project_access(db, payload.project_id, owner_username)
    graph_hash = sha256_json(payload.graph)
    last_run_id = _validated_last_run_id(
        db, run_id=payload.last_run_id, owner_username=owner_username, project_id=payload.project_id
    )
    workflow = Workflow(
        name=payload.name.strip(),
        graph=payload.graph,
        project_id=payload.project_id,
        owner_username=owner_username,
        revision=1,
        graph_hash=graph_hash,
        last_run_id=last_run_id,
        last_autosaved_at=utcnow(),
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow


def get_workflow(db: Session, workflow_id: int, owner_username: str) -> Workflow:
    workflow = workflow_repository.get(db, workflow_id, owner_username)
    if not workflow:
        raise NotFoundError("WORKFLOW_NOT_FOUND", "Workflow not found.", {"workflow_id": workflow_id})
    return workflow


def update_workflow(db: Session, workflow_id: int, payload: WorkflowCreate, owner_username: str) -> Workflow:
    _assert_valid(payload.graph)
    _assert_project_access(db, payload.project_id, owner_username)
    workflow = get_workflow(db, workflow_id, owner_username)
    graph_hash = sha256_json(payload.graph)
    last_run_id = _validated_last_run_id(
        db, run_id=payload.last_run_id, owner_username=owner_username, project_id=payload.project_id, workflow_id=workflow.id
    )
    changed = graph_hash != workflow.graph_hash or payload.name.strip() != workflow.name or payload.project_id != workflow.project_id or last_run_id != workflow.last_run_id
    if changed:
        workflow.revision += 1
        workflow.name = payload.name.strip()
        workflow.graph = payload.graph
        workflow.project_id = payload.project_id
        workflow.graph_hash = graph_hash
        workflow.last_run_id = last_run_id
        workflow.last_autosaved_at = utcnow()
        db.commit()
        db.refresh(workflow)
    return workflow


def rename_workflow(db: Session, workflow_id: int, name: str, owner_username: str) -> Workflow:
    workflow = get_workflow(db, workflow_id, owner_username)
    next_name = name.strip()
    if not next_name:
        raise ValidationAppError("WORKFLOW_NAME_REQUIRED", "Workflow name is required.")
    if next_name == workflow.name:
        return workflow
    workflow.name = next_name
    workflow.revision += 1
    workflow.last_autosaved_at = utcnow()
    db.commit()
    db.refresh(workflow)
    return workflow


def delete_workflow(db: Session, workflow_id: int, owner_username: str) -> None:
    workflow = get_workflow(db, workflow_id, owner_username)
    active_run = (
        db.query(Run.id)
        .filter(
            Run.workflow_id == workflow.id,
            Run.owner_username == owner_username,
            Run.status.in_(("queued", "running")),
        )
        .first()
    )
    if active_run:
        raise ConflictError(
            "WORKFLOW_HAS_ACTIVE_RUN",
            "Stop the active workflow run before deleting this workflow.",
            {"workflow_id": workflow.id, "run_id": active_run[0]},
        )

    # Preserve historical runs and their graph snapshots, but detach them from
    # the deleted workflow so project history remains available.
    (
        db.query(Run)
        .filter(Run.workflow_id == workflow.id, Run.owner_username == owner_username)
        .update({"workflow_id": None}, synchronize_session=False)
    )
    db.query(WorkflowVersion).filter(
        WorkflowVersion.workflow_id == workflow.id,
        WorkflowVersion.owner_username == owner_username,
    ).delete(synchronize_session=False)
    db.delete(workflow)
    db.commit()


def autosave_workflow(db: Session, workflow_id: int, payload: WorkflowAutosaveIn, owner_username: str) -> Workflow:
    _assert_valid(payload.graph)
    _assert_project_access(db, payload.project_id, owner_username)
    workflow = get_workflow(db, workflow_id, owner_username)
    graph_hash = sha256_json(payload.graph)
    last_run_id = _validated_last_run_id(
        db, run_id=payload.last_run_id, owner_username=owner_username, project_id=payload.project_id, workflow_id=workflow.id
    )
    if payload.client_graph_hash and payload.client_graph_hash != graph_hash:
        raise ValidationAppError("GRAPH_HASH_MISMATCH", "Client workflow hash does not match the submitted graph.")
    if payload.base_revision is not None and payload.base_revision != workflow.revision and graph_hash != workflow.graph_hash:
        raise ConflictError(
            "WORKFLOW_REVISION_CONFLICT",
            "The workflow was changed in another session.",
            {"server_revision": workflow.revision, "server_graph_hash": workflow.graph_hash},
        )
    changed = graph_hash != workflow.graph_hash or payload.name.strip() != workflow.name or payload.project_id != workflow.project_id or last_run_id != workflow.last_run_id
    if not changed:
        return workflow
    workflow.revision += 1
    workflow.name = payload.name.strip()
    workflow.graph = payload.graph
    workflow.project_id = payload.project_id
    workflow.graph_hash = graph_hash
    workflow.last_run_id = last_run_id
    workflow.last_autosaved_at = utcnow()
    db.commit()
    db.refresh(workflow)
    return workflow


def create_version(db: Session, workflow_id: int, payload: WorkflowVersionCreate, owner_username: str) -> WorkflowVersion:
    workflow = workflow_repository.get_for_update(db, workflow_id, owner_username)
    if not workflow:
        raise NotFoundError("WORKFLOW_NOT_FOUND", "Workflow not found.", {"workflow_id": workflow_id})
    if payload.run_id is not None:
        run = db.get(Run, payload.run_id)
        if (
            not run
            or run.owner_username != owner_username
            or run.project_id != workflow.project_id
            or run.workflow_id not in {None, workflow_id}
            or run.status != "succeeded"
        ):
            raise ValidationAppError("INVALID_VERSION_RUN", "Only a successful run from this workflow can be attached to the version.")
    count = db.query(func.count(WorkflowVersion.id)).filter(WorkflowVersion.workflow_id == workflow_id).scalar() or 0
    if int(count) >= get_settings().workflow_version_limit:
        raise ConflictError(
            "WORKFLOW_VERSION_LIMIT_REACHED",
            "Workflow version limit reached. Delete an older named version first.",
            {"limit": get_settings().workflow_version_limit},
        )
    next_number = int(db.query(func.coalesce(func.max(WorkflowVersion.version_number), 0)).filter(WorkflowVersion.workflow_id == workflow_id).scalar() or 0) + 1
    version = WorkflowVersion(
        workflow_id=workflow.id,
        version_number=next_number,
        name=payload.name.strip(),
        description=payload.description.strip(),
        graph=workflow.graph,
        graph_hash=workflow.graph_hash,
        source_revision=workflow.revision,
        run_id=payload.run_id if payload.run_id is not None else workflow.last_run_id,
        owner_username=owner_username,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


def list_versions(db: Session, workflow_id: int, owner_username: str) -> list[WorkflowVersion]:
    get_workflow(db, workflow_id, owner_username)
    return workflow_repository.list_versions(db, workflow_id, owner_username)


def get_version(db: Session, workflow_id: int, version_id: int, owner_username: str) -> WorkflowVersion:
    get_workflow(db, workflow_id, owner_username)
    version = workflow_repository.get_version(db, workflow_id, version_id, owner_username)
    if not version:
        raise NotFoundError("WORKFLOW_VERSION_NOT_FOUND", "Workflow version not found.", {"version_id": version_id})
    return version


def restore_version(db: Session, workflow_id: int, version_id: int, owner_username: str) -> Workflow:
    workflow = get_workflow(db, workflow_id, owner_username)
    version = get_version(db, workflow_id, version_id, owner_username)
    _assert_valid(version.graph)
    workflow.graph = version.graph
    workflow.graph_hash = version.graph_hash
    workflow.last_run_id = version.run_id
    workflow.revision += 1
    workflow.last_autosaved_at = utcnow()
    db.commit()
    db.refresh(workflow)
    return workflow


def delete_version(db: Session, workflow_id: int, version_id: int, owner_username: str) -> None:
    version = get_version(db, workflow_id, version_id, owner_username)
    db.delete(version)
    db.commit()
