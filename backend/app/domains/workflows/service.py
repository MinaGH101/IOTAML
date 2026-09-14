"""Workflow-domain business logic for the IOTA ML backend.

This module sits between the HTTP route layer and the database repository/model
layer. It is responsible for enforcing workflow rules such as:

- Draft graph validation.
- Project ownership checks.
- Workflow creation, update, autosave, rename, and deletion.
- Attaching only valid successful runs to workflows and versions.
- Optimistic concurrency control through revisions and graph hashes.
- Named workflow-version creation, restoration, listing, and deletion.

The functions in this module receive an active SQLAlchemy ``Session``. Most
write operations commit their own transaction and refresh the affected ORM
object before returning it.
"""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationAppError
from app.domains.workflows.repository import workflow_repository
from app.domains.workflows.schemas import WorkflowAutosaveIn, WorkflowCreate, WorkflowVersionCreate
from app.domains.projects.models import Project
from app.domains.runs.models import Run
from app.domains.workflows.models import Workflow, WorkflowVersion
from app.workflow.caching.keys import sha256_json
from app.infrastructure.queue.state import utcnow
from app.workflow.validation.service import validate_workflow_graph


# ---------------------------------------------------------------------------
# Graph validation helpers
# ---------------------------------------------------------------------------

def validate_graph(graph: dict) -> dict:
    """Validate a workflow graph and return a serializable validation report.

    Args:
        graph:
            Workflow graph dictionary, normally containing ``nodes`` and
            ``edges``. An empty or false-like value is treated as an empty
            graph.

    Returns:
        A dictionary produced from the validation result model. It typically
        contains whether the graph is valid, validation errors, and warnings.

    Side effects:
        None. This function does not modify the graph or database.
    """
    result = validate_workflow_graph(graph or {})
    return result.model_dump()


def _assert_valid_draft(graph: dict) -> None:
    """Ensure a graph is structurally acceptable as an editable draft.

    Draft validation is intentionally less strict than execution validation.
    Missing node settings and missing connections are allowed because a user
    may save an incomplete workflow while still designing it.

    Args:
        graph:
            Workflow graph to validate.

    Returns:
        ``None`` when the draft is valid.

    Raises:
        ValidationAppError:
            When the graph contains structural errors that make it invalid
            even as a draft.
    """
    validation = validate_workflow_graph(
        graph,
        require_settings=False,
        require_connections=False,
    )
    if not validation.valid:
        raise ValidationAppError(
            "WORKFLOW_VALIDATION_FAILED",
            "Workflow validation failed.",
            {"errors": [error.model_dump() for error in validation.errors]},
        )


# ---------------------------------------------------------------------------
# Ownership and relationship validation helpers
# ---------------------------------------------------------------------------

def _assert_project_access(db: Session, project_id: int | None, owner_username: str) -> None:
    """Verify that an optional project exists and belongs to the current user.

    Args:
        db:
            Active SQLAlchemy database session.
        project_id:
            Project to validate. ``None`` means that the workflow is not
            assigned to a project, so no check is required.
        owner_username:
            Username expected to own the project.

    Returns:
        ``None`` when access is valid.

    Raises:
        NotFoundError:
            When ``project_id`` does not identify an existing project.
        PermissionDeniedError:
            When the project exists but belongs to another user.
    """
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
    """Validate a run before attaching it as a workflow's latest result.

    A run may be attached only when it:

    - Exists and belongs to the current user.
    - Belongs to the same project as the workflow.
    - Belongs to the same workflow, when a workflow ID is supplied.
    - Finished successfully.

    Args:
        db:
            Active SQLAlchemy database session.
        run_id:
            Candidate run ID. ``None`` means no run should be attached.
        owner_username:
            Username expected to own the run.
        project_id:
            Project associated with the workflow.
        workflow_id:
            Optional workflow ID used when updating an existing workflow.

    Returns:
        The validated run ID, or ``None`` when no run was supplied.

    Raises:
        ValidationAppError:
            When the run is unavailable, belongs to the wrong owner/project/
            workflow, or has not succeeded.
    """
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


# ---------------------------------------------------------------------------
# Workflow CRUD operations
# ---------------------------------------------------------------------------

def create_workflow(db: Session, payload: WorkflowCreate, owner_username: str) -> Workflow:
    """Create and persist a new workflow.

    Processing sequence:

    1. Validate the submitted graph as a draft.
    2. Verify project access.
    3. Calculate a deterministic graph hash.
    4. Validate the optional last successful run.
    5. Create the workflow at revision 1.
    6. Commit and refresh the ORM instance.

    Args:
        db:
            Active SQLAlchemy database session.
        payload:
            Workflow creation data containing the name, graph, optional project,
            and optional last run.
        owner_username:
            Username that will own the new workflow.

    Returns:
        The newly persisted and refreshed ``Workflow`` ORM object.

    Raises:
        ValidationAppError:
            For an invalid draft or invalid attached run.
        NotFoundError:
            When the selected project does not exist.
        PermissionDeniedError:
            When the selected project belongs to another user.
    """
    _assert_valid_draft(payload.graph)
    _assert_project_access(db, payload.project_id, owner_username)

    graph_hash = sha256_json(payload.graph)
    last_run_id = _validated_last_run_id(
        db,
        run_id=payload.last_run_id,
        owner_username=owner_username,
        project_id=payload.project_id,
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
    """Return a workflow owned by a specific user.

    Args:
        db:
            Active SQLAlchemy database session.
        workflow_id:
            Primary key of the workflow.
        owner_username:
            Username that must own the workflow.

    Returns:
        The matching ``Workflow`` ORM object.

    Raises:
        NotFoundError:
            When the workflow does not exist or is not owned by the user.
    """
    workflow = workflow_repository.get(db, workflow_id, owner_username)
    if not workflow:
        raise NotFoundError("WORKFLOW_NOT_FOUND", "Workflow not found.", {"workflow_id": workflow_id})
    return workflow


def update_workflow(
    db: Session,
    workflow_id: int,
    payload: WorkflowCreate,
    owner_username: str,
) -> Workflow:
    """Replace the editable state of an existing workflow.

    The revision is incremented only when the graph, name, project, or attached
    last run actually changes.

    Args:
        db:
            Active SQLAlchemy database session.
        workflow_id:
            Workflow to update.
        payload:
            Complete replacement state for the workflow.
        owner_username:
            Username that must own the workflow.

    Returns:
        The updated workflow. When nothing changed, the existing object is
        returned without committing a new revision.

    Raises:
        ValidationAppError:
            For an invalid graph or attached run.
        NotFoundError:
            When the workflow/project does not exist.
        PermissionDeniedError:
            When the selected project is not owned by the user.
    """
    _assert_valid_draft(payload.graph)
    _assert_project_access(db, payload.project_id, owner_username)

    workflow = get_workflow(db, workflow_id, owner_username)
    graph_hash = sha256_json(payload.graph)
    last_run_id = _validated_last_run_id(
        db,
        run_id=payload.last_run_id,
        owner_username=owner_username,
        project_id=payload.project_id,
        workflow_id=workflow.id,
    )

    # A new revision is created only for a meaningful persisted change.
    changed = (
        graph_hash != workflow.graph_hash
        or payload.name.strip() != workflow.name
        or payload.project_id != workflow.project_id
        or last_run_id != workflow.last_run_id
    )
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
    """Rename a workflow and create a new revision.

    Args:
        db:
            Active SQLAlchemy database session.
        workflow_id:
            Workflow to rename.
        name:
            New name. Surrounding whitespace is removed.
        owner_username:
            Username that must own the workflow.

    Returns:
        The renamed workflow. If the normalized name is unchanged, the
        workflow is returned without a database write.

    Raises:
        ValidationAppError:
            When the normalized name is empty.
        NotFoundError:
            When the workflow is unavailable to the user.
    """
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
    """Delete a workflow while preserving its historical run records.

    Active queued/running executions prevent deletion. Historical runs are not
    deleted; instead, their ``workflow_id`` is cleared so project execution
    history remains available. Named workflow versions are deleted with the
    workflow.

    Args:
        db:
            Active SQLAlchemy database session.
        workflow_id:
            Workflow to delete.
        owner_username:
            Username that must own the workflow.

    Returns:
        ``None``.

    Raises:
        NotFoundError:
            When the workflow does not exist or is not owned by the user.
        ConflictError:
            When the workflow still has a queued or running execution.
    """
    workflow = get_workflow(db, workflow_id, owner_username)

    # Deletion is blocked while an execution still depends on this workflow.
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

    # Named versions belong to the workflow itself and are removed with it.
    db.query(WorkflowVersion).filter(
        WorkflowVersion.workflow_id == workflow.id,
        WorkflowVersion.owner_username == owner_username,
    ).delete(synchronize_session=False)

    db.delete(workflow)
    db.commit()


# ---------------------------------------------------------------------------
# Autosave and optimistic-concurrency handling
# ---------------------------------------------------------------------------

def autosave_workflow(
    db: Session,
    workflow_id: int,
    payload: WorkflowAutosaveIn,
    owner_username: str,
) -> Workflow:
    """Autosave a workflow with hash and revision conflict protection.

    ``client_graph_hash`` detects client-side hashing inconsistencies.
    ``base_revision`` prevents one browser/session from silently overwriting
    changes saved by another session.

    Args:
        db:
            Active SQLAlchemy database session.
        workflow_id:
            Workflow being autosaved.
        payload:
            Autosave data containing the graph, name, project, optional run,
            client graph hash, and base revision.
        owner_username:
            Username that must own the workflow.

    Returns:
        The updated workflow, or the unchanged workflow when the submitted
        state matches the persisted state.

    Raises:
        ValidationAppError:
            For invalid drafts, invalid attached runs, or a graph-hash mismatch.
        ConflictError:
            When another session changed the workflow after ``base_revision``.
        NotFoundError:
            When the workflow/project does not exist.
        PermissionDeniedError:
            When project access is invalid.
    """
    _assert_valid_draft(payload.graph)
    _assert_project_access(db, payload.project_id, owner_username)

    workflow = get_workflow(db, workflow_id, owner_username)
    graph_hash = sha256_json(payload.graph)
    # The latest successful run is execution state owned by the server. Draft
    # autosave must never clear or roll it back with a stale browser snapshot.

    # The client's claimed hash must describe the exact submitted graph.
    if payload.client_graph_hash and payload.client_graph_hash != graph_hash:
        raise ValidationAppError(
            "GRAPH_HASH_MISMATCH",
            "Client workflow hash does not match the submitted graph.",
        )

    # A stale revision is allowed only when the graph is still identical.
    if (
        payload.base_revision is not None
        and payload.base_revision != workflow.revision
        and graph_hash != workflow.graph_hash
    ):
        raise ConflictError(
            "WORKFLOW_REVISION_CONFLICT",
            "The workflow was changed in another session.",
            {
                "server_revision": workflow.revision,
                "server_graph_hash": workflow.graph_hash,
            },
        )

    changed = (
        graph_hash != workflow.graph_hash
        or payload.name.strip() != workflow.name
        or payload.project_id != workflow.project_id
    )
    if not changed:
        return workflow

    workflow.revision += 1
    workflow.name = payload.name.strip()
    workflow.graph = payload.graph
    workflow.project_id = payload.project_id
    workflow.graph_hash = graph_hash
    workflow.last_autosaved_at = utcnow()
    db.commit()
    db.refresh(workflow)
    return workflow


# ---------------------------------------------------------------------------
# Named workflow-version operations
# ---------------------------------------------------------------------------

def create_version(
    db: Session,
    workflow_id: int,
    payload: WorkflowVersionCreate,
    owner_username: str,
) -> WorkflowVersion:
    """Create an immutable named snapshot of the current workflow.

    The workflow row is locked with ``SELECT ... FOR UPDATE`` so simultaneous
    version-creation requests cannot safely compute the same version number.

    Args:
        db:
            Active SQLAlchemy database session.
        workflow_id:
            Workflow whose current state should be snapshotted.
        payload:
            Version name, description, and optional successful run ID.
        owner_username:
            Username that must own the workflow and attached run.

    Returns:
        The newly created ``WorkflowVersion`` ORM object.

    Raises:
        NotFoundError:
            When the workflow does not exist or is not owned by the user.
        ValidationAppError:
            When the explicitly supplied run is not a successful compatible run.
        ConflictError:
            When the configured per-workflow version limit has been reached.
    """
    # Lock the workflow row to serialize version-number allocation.
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
            raise ValidationAppError(
                "INVALID_VERSION_RUN",
                "Only a successful run from this workflow can be attached to the version.",
            )

    count = (
        db.query(func.count(WorkflowVersion.id))
        .filter(WorkflowVersion.workflow_id == workflow_id)
        .scalar()
        or 0
    )
    if int(count) >= get_settings().workflow_version_limit:
        raise ConflictError(
            "WORKFLOW_VERSION_LIMIT_REACHED",
            "Workflow version limit reached. Delete an older named version first.",
            {"limit": get_settings().workflow_version_limit},
        )

    # Version numbers increase monotonically within each workflow.
    next_number = (
        int(
            db.query(func.coalesce(func.max(WorkflowVersion.version_number), 0))
            .filter(WorkflowVersion.workflow_id == workflow_id)
            .scalar()
            or 0
        )
        + 1
    )

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


def list_versions(
    db: Session,
    workflow_id: int,
    owner_username: str,
) -> list[WorkflowVersion]:
    """List all named versions of a workflow, newest version number first.

    Args:
        db:
            Active SQLAlchemy database session.
        workflow_id:
            Parent workflow ID.
        owner_username:
            Username that must own the workflow and versions.

    Returns:
        A list of ``WorkflowVersion`` objects.

    Raises:
        NotFoundError:
            When the parent workflow is unavailable to the user.
    """
    # Validate workflow ownership before querying its versions.
    get_workflow(db, workflow_id, owner_username)
    return workflow_repository.list_versions(db, workflow_id, owner_username)


def get_version(
    db: Session,
    workflow_id: int,
    version_id: int,
    owner_username: str,
) -> WorkflowVersion:
    """Return one named version belonging to a workflow and user.

    Args:
        db:
            Active SQLAlchemy database session.
        workflow_id:
            Parent workflow ID.
        version_id:
            Workflow-version primary key.
        owner_username:
            Username that must own both records.

    Returns:
        The matching ``WorkflowVersion`` ORM object.

    Raises:
        NotFoundError:
            When the workflow or requested version is unavailable.
    """
    get_workflow(db, workflow_id, owner_username)
    version = workflow_repository.get_version(
        db,
        workflow_id,
        version_id,
        owner_username,
    )
    if not version:
        raise NotFoundError(
            "WORKFLOW_VERSION_NOT_FOUND",
            "Workflow version not found.",
            {"version_id": version_id},
        )
    return version


def restore_version(
    db: Session,
    workflow_id: int,
    version_id: int,
    owner_username: str,
) -> Workflow:
    """Restore a saved version into the editable workflow.

    Restoration copies the version graph, hash, and associated run back to the
    current workflow. The workflow name and project are not changed.

    Args:
        db:
            Active SQLAlchemy database session.
        workflow_id:
            Workflow to modify.
        version_id:
            Saved version to restore.
        owner_username:
            Username that must own both records.

    Returns:
        The refreshed current ``Workflow`` after restoration.

    Raises:
        NotFoundError:
            When the workflow or version is unavailable.
        ValidationAppError:
            When the stored version graph is no longer valid as a draft.
    """
    workflow = get_workflow(db, workflow_id, owner_username)
    version = get_version(db, workflow_id, version_id, owner_username)

    # Defensive validation protects against restoring legacy/corrupt snapshots.
    _assert_valid_draft(version.graph)

    workflow.graph = version.graph
    workflow.graph_hash = version.graph_hash
    workflow.last_run_id = version.run_id
    workflow.revision += 1
    workflow.last_autosaved_at = utcnow()
    db.commit()
    db.refresh(workflow)
    return workflow


def delete_version(
    db: Session,
    workflow_id: int,
    version_id: int,
    owner_username: str,
) -> None:
    """Delete one named workflow version.

    Args:
        db:
            Active SQLAlchemy database session.
        workflow_id:
            Parent workflow ID.
        version_id:
            Version to delete.
        owner_username:
            Username that must own the workflow/version.

    Returns:
        ``None``.

    Raises:
        NotFoundError:
            When the workflow or version is unavailable.
    """
    version = get_version(db, workflow_id, version_id, owner_username)
    db.delete(version)
    db.commit()
