"""Workflow routes with project-level authorization."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.domains.auth.models import User
from app.domains.auth.service import get_current_user_model
from app.domains.projects.access import require_project_edit, require_project_view
from app.domains.workflows.repository import workflow_repository
from app.domains.workflows.schemas import (
    WorkflowAutosaveIn, WorkflowCreate, WorkflowOut, WorkflowRenameIn,
    WorkflowVersionCreate, WorkflowVersionOut, WorkflowVersionSummaryOut,
)
from app.domains.workflows.service import (
    autosave_workflow, create_version, create_workflow, delete_version, delete_workflow,
    get_version, get_workflow, list_versions, rename_workflow, restore_version,
    update_workflow, validate_graph,
)

router = APIRouter(prefix='/workflows', tags=['workflows'])


def _workflow_and_owner(db: Session, workflow_id: int, user: User, *, write: bool = False):
    workflow = workflow_repository.get(db, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail='Workflow not found.')
    if workflow.project_id is None:
        if workflow.owner_username.lower() != user.username.lower():
            raise HTTPException(status_code=404, detail='Workflow not found.')
    elif write:
        require_project_edit(db, workflow.project_id, user)
    else:
        require_project_view(db, workflow.project_id, user)
    return workflow, workflow.owner_username


@router.post('/validate')
def validate_workflow(payload: dict, _: User = Depends(get_current_user_model)):
    graph = payload.get('graph') if isinstance(payload, dict) and 'graph' in payload else payload
    return validate_graph(graph or {})


@router.post('', response_model=WorkflowOut)
def create(payload: WorkflowCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    owner = current_user.username
    if payload.project_id is not None:
        project, _ = require_project_edit(db, payload.project_id, current_user)
        owner = project.owner_username
    return create_workflow(db, payload, owner)


@router.get('', response_model=list[WorkflowOut])
def list_all(project_id: int | None = None, limit: int = Query(default=50, ge=1), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    owner = current_user.username
    if project_id is not None:
        project, _ = require_project_view(db, project_id, current_user)
        owner = project.owner_username
    return workflow_repository.list(db, project_id, owner, limit=min(limit, get_settings().api_max_page_size), offset=offset)


@router.get('/{workflow_id}', response_model=WorkflowOut)
def get_one(workflow_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner = _workflow_and_owner(db, workflow_id, current_user)
    return get_workflow(db, workflow_id, owner)


@router.put('/{workflow_id}', response_model=WorkflowOut)
def update(workflow_id: int, payload: WorkflowCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner = _workflow_and_owner(db, workflow_id, current_user, write=True)
    if payload.project_id is not None:
        target, _ = require_project_edit(db, payload.project_id, current_user)
        if target.owner_username.lower() != owner.lower():
            raise HTTPException(status_code=400, detail='A workflow cannot be moved between different project owners.')
    return update_workflow(db, workflow_id, payload, owner)


@router.patch('/{workflow_id}/name', response_model=WorkflowOut)
def rename(workflow_id: int, payload: WorkflowRenameIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner = _workflow_and_owner(db, workflow_id, current_user, write=True)
    return rename_workflow(db, workflow_id, payload.name, owner)


@router.delete('/{workflow_id}')
def remove(workflow_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner = _workflow_and_owner(db, workflow_id, current_user, write=True)
    delete_workflow(db, workflow_id, owner)
    return {'ok': True}


@router.put('/{workflow_id}/autosave', response_model=WorkflowOut)
def autosave(workflow_id: int, payload: WorkflowAutosaveIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner = _workflow_and_owner(db, workflow_id, current_user, write=True)
    return autosave_workflow(db, workflow_id, payload, owner)


@router.post('/{workflow_id}/versions', response_model=WorkflowVersionOut)
def save_version(workflow_id: int, payload: WorkflowVersionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner = _workflow_and_owner(db, workflow_id, current_user, write=True)
    return create_version(db, workflow_id, payload, owner)


@router.get('/{workflow_id}/versions', response_model=list[WorkflowVersionSummaryOut])
def versions(workflow_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner = _workflow_and_owner(db, workflow_id, current_user)
    return list_versions(db, workflow_id, owner)


@router.get('/{workflow_id}/versions/{version_id}', response_model=WorkflowVersionOut)
def version(workflow_id: int, version_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner = _workflow_and_owner(db, workflow_id, current_user)
    return get_version(db, workflow_id, version_id, owner)


@router.post('/{workflow_id}/versions/{version_id}/restore', response_model=WorkflowOut)
def restore(workflow_id: int, version_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner = _workflow_and_owner(db, workflow_id, current_user, write=True)
    return restore_version(db, workflow_id, version_id, owner)


@router.delete('/{workflow_id}/versions/{version_id}')
def remove_version(workflow_id: int, version_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner = _workflow_and_owner(db, workflow_id, current_user, write=True)
    delete_version(db, workflow_id, version_id, owner)
    return {'ok': True}
