from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, ValidationAppError
from app.domains.workflows.repository import workflow_repository
from app.domains.workflows.schemas import WorkflowCreate
from app.models import Workflow
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


def create_workflow(db: Session, payload: WorkflowCreate) -> Workflow:
    _assert_valid(payload.graph)
    workflow = Workflow(name=payload.name, graph=payload.graph, project_id=payload.project_id)
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow


def get_workflow(db: Session, workflow_id: int) -> Workflow:
    workflow = workflow_repository.get(db, workflow_id)
    if not workflow:
        raise NotFoundError("WORKFLOW_NOT_FOUND", "Workflow not found.", {"workflow_id": workflow_id})
    return workflow


def update_workflow(db: Session, workflow_id: int, payload: WorkflowCreate) -> Workflow:
    _assert_valid(payload.graph)
    workflow = get_workflow(db, workflow_id)
    workflow.name = payload.name
    workflow.graph = payload.graph
    workflow.project_id = payload.project_id
    db.commit()
    db.refresh(workflow)
    return workflow
