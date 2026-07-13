from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.domains.workflows.repository import workflow_repository
from app.domains.workflows.schemas import WorkflowCreate, WorkflowOut
from app.domains.workflows.service import create_workflow, get_workflow, update_workflow, validate_graph

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.post("/validate")
def validate_workflow(payload: dict):
    graph = payload.get("graph") if isinstance(payload, dict) and "graph" in payload else payload
    return validate_graph(graph or {})


@router.post("", response_model=WorkflowOut)
def create(payload: WorkflowCreate, db: Session = Depends(get_db)):
    return create_workflow(db, payload)


@router.get("", response_model=list[WorkflowOut])
def list_all(project_id: int | None = None, db: Session = Depends(get_db)):
    return workflow_repository.list(db, project_id)


@router.get("/{workflow_id}", response_model=WorkflowOut)
def get_one(workflow_id: int, db: Session = Depends(get_db)):
    return get_workflow(db, workflow_id)


@router.put("/{workflow_id}", response_model=WorkflowOut)
def update(workflow_id: int, payload: WorkflowCreate, db: Session = Depends(get_db)):
    return update_workflow(db, workflow_id, payload)
