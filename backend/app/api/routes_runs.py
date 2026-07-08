from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Run
from app.schemas import RunCreate, RunOut
from app.services.jobs import enqueue_run

router = APIRouter(prefix='/runs', tags=['runs'])

@router.post('', response_model=RunOut)
def create_run(payload: RunCreate, db: Session = Depends(get_db)) -> Run:
    run = Run(
        workflow_name=payload.workflow_name,
        workflow_graph=payload.workflow_graph,
        dataset_id=payload.dataset_id,
        project_id=payload.project_id,
        target_column=payload.target_column,
        task_type=payload.task_type,
        status='queued',
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    enqueue_run(run.id)
    return run

@router.get('', response_model=list[RunOut])
def list_runs(project_id: int | None = None, db: Session = Depends(get_db)) -> list[Run]:
    query = db.query(Run)
    if project_id is not None:
        query = query.filter(Run.project_id == project_id)
    return query.order_by(Run.created_at.desc()).limit(50).all()

@router.get('/{run_id}', response_model=RunOut)
def get_run(run_id: int, db: Session = Depends(get_db)) -> Run:
    run = db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail='Run not found.')
    return run

@router.get('/{run_id}/progress')
def get_run_progress(run_id: int, db: Session = Depends(get_db)) -> dict:
    run = db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail='Run not found.')
    artifacts = run.artifacts or {}
    outputs = artifacts.get('node_outputs') or {}
    graph_nodes = (run.workflow_graph or {}).get('nodes') or []
    return {
        'run_id': run.id,
        'status': run.status,
        'nodes_total': len(graph_nodes),
        'nodes_finished': len(outputs),
        'node_outputs': outputs,
        'errors': artifacts.get('errors') or [],
    }

@router.get('/{run_id}/nodes/{node_id}/preview')
def get_node_preview(run_id: int, node_id: str, db: Session = Depends(get_db)) -> dict:
    run = db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail='Run not found.')
    output = ((run.artifacts or {}).get('node_outputs') or {}).get(node_id)
    if not output:
        raise HTTPException(status_code=404, detail='Node result not found.')
    return output

@router.post('/{run_id}/cancel')
def cancel_run(run_id: int, db: Session = Depends(get_db)) -> dict:
    run = db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail='Run not found.')
    if run.status in {'queued', 'running'}:
        run.status = 'failed'
        run.error = 'Cancelled by user.'
        db.commit()
    return {'ok': True, 'status': run.status}
