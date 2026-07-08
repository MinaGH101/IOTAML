from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Workflow
from app.schemas import WorkflowCreate, WorkflowOut
from app.workflow.validator import validate_workflow_graph

router = APIRouter(prefix='/workflows', tags=['workflows'])

@router.post('/validate')
def validate_workflow(payload: dict) -> dict:
    graph = payload.get('graph') if isinstance(payload, dict) and 'graph' in payload else payload
    return validate_workflow_graph(graph or {}).model_dump()

@router.post('', response_model=WorkflowOut)
def create_workflow(payload: WorkflowCreate, db: Session = Depends(get_db)) -> Workflow:
    validation = validate_workflow_graph(payload.graph)
    if not validation.valid:
        raise HTTPException(status_code=400, detail='; '.join(error.message for error in validation.errors))
    workflow = Workflow(name=payload.name, graph=payload.graph, project_id=payload.project_id)
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow

@router.get('', response_model=list[WorkflowOut])
def list_workflows(project_id: int | None = None, db: Session = Depends(get_db)) -> list[Workflow]:
    query = db.query(Workflow)
    if project_id is not None:
        query = query.filter(Workflow.project_id == project_id)
    return query.order_by(Workflow.updated_at.desc()).all()

@router.get('/{workflow_id}', response_model=WorkflowOut)
def get_workflow(workflow_id: int, db: Session = Depends(get_db)) -> Workflow:
    workflow = db.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail='Workflow not found.')
    return workflow

@router.put('/{workflow_id}', response_model=WorkflowOut)
def update_workflow(workflow_id: int, payload: WorkflowCreate, db: Session = Depends(get_db)) -> Workflow:
    validation = validate_workflow_graph(payload.graph)
    if not validation.valid:
        raise HTTPException(status_code=400, detail='; '.join(error.message for error in validation.errors))
    workflow = db.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail='Workflow not found.')
    workflow.name = payload.name
    workflow.graph = payload.graph
    workflow.project_id = payload.project_id
    db.commit()
    db.refresh(workflow)
    return workflow
