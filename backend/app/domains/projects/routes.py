from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.domains.projects.repository import project_repository
from app.domains.projects.schemas import ProjectCreate, ProjectOut, ProjectUpdate
from app.domains.projects.service import create_project, delete_project, get_project, to_output, update_project
from app.services.users import get_current_user

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectOut)
def create(payload: ProjectCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return create_project(db, payload, current_user)


@router.get("", response_model=list[ProjectOut])
def list_all(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    del current_user
    return [to_output(project, db) for project in project_repository.list(db)]


@router.get("/{project_id}", response_model=ProjectOut)
def get_one(project_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    del current_user
    return to_output(get_project(db, project_id), db)


@router.put("/{project_id}", response_model=ProjectOut)
def update(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    del current_user
    return update_project(db, project_id, payload)


@router.delete("/{project_id}")
def remove(project_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    del current_user
    delete_project(db, project_id)
    return {"ok": True}
