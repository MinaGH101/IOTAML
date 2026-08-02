"""Project API routes."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.domains.auth.models import ROLE_ADMIN, ROLE_MANAGER, User
from app.domains.auth.service import get_current_user_model, normalize_role
from app.domains.projects.schemas import ProjectCreate, ProjectOut, ProjectUpdate
from app.domains.projects.service import acknowledge_assignment, create_project, delete_project, get_project, list_projects, to_output, update_project

router = APIRouter(prefix='/projects', tags=['projects'])


@router.get('/assignable-users')
def assignable_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    if normalize_role(current_user.role) not in {ROLE_ADMIN, ROLE_MANAGER}:
        return []
    users = db.scalars(select(User).where(User.is_active.is_(True), User.id != current_user.id).order_by(User.first_name, User.last_name, User.username)).all()
    return [{'id': user.id, 'username': user.username, 'display_name': f'{user.first_name} {user.last_name}'.strip() or user.username, 'role': normalize_role(user.role)} for user in users]


@router.post('', response_model=ProjectOut)
def create(payload: ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    return create_project(db, payload, current_user)


@router.get('', response_model=list[ProjectOut])
def list_all(limit: int = Query(default=200, ge=1), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    return list_projects(db, current_user, limit=min(limit, get_settings().api_max_page_size), offset=offset)


@router.get('/{project_id}', response_model=ProjectOut)
def get_one(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    project = get_project(db, project_id, current_user, acknowledge=True)
    return to_output(project, db, current_user)


@router.post('/{project_id}/acknowledge')
def acknowledge(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    acknowledge_assignment(db, project_id, current_user)
    return {'ok': True}


@router.put('/{project_id}', response_model=ProjectOut)
def update(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    return update_project(db, project_id, payload, current_user)


@router.delete('/{project_id}')
def remove(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    delete_project(db, project_id, current_user)
    return {'ok': True}
