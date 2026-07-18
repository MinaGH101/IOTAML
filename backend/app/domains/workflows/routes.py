from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.domains.workflows.repository import workflow_repository
from app.domains.workflows.schemas import (
    WorkflowAutosaveIn,
    WorkflowCreate,
    WorkflowOut,
    WorkflowRenameIn,
    WorkflowVersionCreate,
    WorkflowVersionOut,
    WorkflowVersionSummaryOut,
)
from app.domains.workflows.service import (
    autosave_workflow,
    create_version,
    create_workflow,
    delete_workflow,
    delete_version,
    get_version,
    get_workflow,
    list_versions,
    rename_workflow,
    restore_version,
    update_workflow,
    validate_graph,
)
from app.services.users import get_current_user

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.post("/validate")
def validate_workflow(payload: dict):
    graph = payload.get("graph") if isinstance(payload, dict) and "graph" in payload else payload
    return validate_graph(graph or {})


@router.post("", response_model=WorkflowOut)
def create(payload: WorkflowCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return create_workflow(db, payload, str(current_user["username"]))


@router.get("", response_model=list[WorkflowOut])
def list_all(project_id: int | None = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return workflow_repository.list(db, project_id, str(current_user["username"]))


@router.get("/{workflow_id}", response_model=WorkflowOut)
def get_one(workflow_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return get_workflow(db, workflow_id, str(current_user["username"]))


@router.put("/{workflow_id}", response_model=WorkflowOut)
def update(workflow_id: int, payload: WorkflowCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return update_workflow(db, workflow_id, payload, str(current_user["username"]))


@router.patch("/{workflow_id}/name", response_model=WorkflowOut)
def rename(workflow_id: int, payload: WorkflowRenameIn, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return rename_workflow(db, workflow_id, payload.name, str(current_user["username"]))


@router.delete("/{workflow_id}")
def remove(workflow_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    delete_workflow(db, workflow_id, str(current_user["username"]))
    return {"ok": True}


@router.put("/{workflow_id}/autosave", response_model=WorkflowOut)
def autosave(workflow_id: int, payload: WorkflowAutosaveIn, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return autosave_workflow(db, workflow_id, payload, str(current_user["username"]))


@router.post("/{workflow_id}/versions", response_model=WorkflowVersionOut)
def save_version(workflow_id: int, payload: WorkflowVersionCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return create_version(db, workflow_id, payload, str(current_user["username"]))


@router.get("/{workflow_id}/versions", response_model=list[WorkflowVersionSummaryOut])
def versions(workflow_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return list_versions(db, workflow_id, str(current_user["username"]))


@router.get("/{workflow_id}/versions/{version_id}", response_model=WorkflowVersionOut)
def version(workflow_id: int, version_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return get_version(db, workflow_id, version_id, str(current_user["username"]))


@router.post("/{workflow_id}/versions/{version_id}/restore", response_model=WorkflowOut)
def restore(workflow_id: int, version_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return restore_version(db, workflow_id, version_id, str(current_user["username"]))


@router.delete("/{workflow_id}/versions/{version_id}")
def remove_version(workflow_id: int, version_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    delete_version(db, workflow_id, version_id, str(current_user["username"]))
    return {"ok": True}
