"""Admin-only user management routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.domains.auth.models import ROLE_ADMIN, User
from app.domains.auth.repository import user_repository
from app.domains.auth.schemas import AdminUserCreate, AdminUserOut, AdminUserUpdate
from app.domains.auth.service import create_user, normalize_role, require_role, update_managed_user, user_to_dict
from app.domains.projects.models import Project, ProjectAssignment
from app.domains.projects.service import assignment_outputs

router = APIRouter(prefix='/admin', tags=['admin'])


def _user_out(db: Session, user: User) -> AdminUserOut:
    owned = int(db.scalar(select(func.count(Project.id)).where(func.lower(Project.owner_username) == user.username.lower())) or 0)
    assigned = int(db.scalar(select(func.count(ProjectAssignment.id)).where(ProjectAssignment.user_id == user.id)) or 0)
    return AdminUserOut(**user_to_dict(user), created_at=user.created_at, updated_at=user.updated_at, owned_project_count=owned, assigned_project_count=assigned)


@router.get('/users', response_model=list[AdminUserOut])
def list_users(
    query: str = '', role: str | None = None, active: bool | None = None,
    limit: int = Query(default=100, ge=1), offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db), _: User = Depends(require_role(ROLE_ADMIN)),
):
    normalized_role = normalize_role(role) if role else None
    users = user_repository.list(db, query=query, role=normalized_role, active=active, limit=min(limit, get_settings().api_max_page_size), offset=offset)
    return [_user_out(db, user) for user in users]


@router.post('/users', response_model=AdminUserOut)
def create_managed_user(payload: AdminUserCreate, db: Session = Depends(get_db), _: User = Depends(require_role(ROLE_ADMIN))):
    return _user_out(db, create_user(db, payload.model_dump()))


@router.get('/users/{user_id}')
def get_managed_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_role(ROLE_ADMIN))):
    user = user_repository.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found.')
    owned_projects = db.scalars(select(Project).where(func.lower(Project.owner_username) == user.username.lower()).order_by(Project.updated_at.desc())).all()
    assignment_rows = db.execute(select(ProjectAssignment, Project).join(Project, Project.id == ProjectAssignment.project_id).where(ProjectAssignment.user_id == user.id).order_by(Project.updated_at.desc())).all()
    return {
        'user': _user_out(db, user),
        'projects': [
            {'id': project.id, 'name': project.name, 'owner_username': project.owner_username, 'access_type': 'owner', 'updated_at': project.updated_at}
            for project in owned_projects
        ] + [
            {'id': project.id, 'name': project.name, 'owner_username': project.owner_username, 'access_type': assignment.access_type, 'updated_at': project.updated_at}
            for assignment, project in assignment_rows
        ],
    }


@router.put('/users/{user_id}', response_model=AdminUserOut)
def update_user(user_id: int, payload: AdminUserUpdate, db: Session = Depends(get_db), admin: User = Depends(require_role(ROLE_ADMIN))):
    user = user_repository.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found.')
    changes = payload.model_dump(exclude_unset=True)
    if changes.get('role') == 'guest':
        owned = int(db.scalar(select(func.count(Project.id)).where(func.lower(Project.owner_username) == user.username.lower())) or 0)
        if owned:
            raise HTTPException(status_code=409, detail='Transfer or delete this user’s owned projects before assigning the guest role.')
    return _user_out(db, update_managed_user(db, user, changes, admin))


@router.delete('/users/{user_id}')
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_role(ROLE_ADMIN))):
    user = user_repository.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found.')
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail='You cannot delete your own admin account.')
    owned = int(db.scalar(select(func.count(Project.id)).where(func.lower(Project.owner_username) == user.username.lower())) or 0)
    if owned:
        raise HTTPException(status_code=409, detail='Transfer or delete this user’s owned projects before deleting the account.')
    db.delete(user); db.commit()
    return {'ok': True}
