"""Project use cases with RBAC and explicit project assignments."""
from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.domains.auth.models import ROLE_ADMIN, ROLE_EXPERT, ROLE_GUEST, ROLE_MANAGER, User
from app.domains.auth.service import normalize_role
from app.domains.projects.access import permission_for_project, require_project_delete, require_project_edit, require_project_view
from app.domains.projects.models import ACCESS_EDIT, ACCESS_VIEW, Project, ProjectAssignment
from app.domains.projects.repository import project_repository
from app.domains.projects.schemas import ProjectCreate, ProjectOut, ProjectUpdate


def _display_name(user: User | None, fallback: str = '') -> str:
    if not user:
        return fallback
    return f'{user.first_name} {user.last_name}'.strip() or user.username


def assignment_outputs(db: Session, project_id: int) -> list[dict]:
    rows = db.execute(
        select(ProjectAssignment, User)
        .join(User, User.id == ProjectAssignment.user_id)
        .where(ProjectAssignment.project_id == project_id)
        .order_by(ProjectAssignment.access_type, ProjectAssignment.assigned_at)
    ).all()
    return [{
        'id': assignment.id,
        'user_id': user.id,
        'username': user.username,
        'display_name': _display_name(user),
        'role': normalize_role(user.role),
        'access_type': assignment.access_type,
        'is_new': assignment.is_new,
        'assigned_at': assignment.assigned_at,
    } for assignment, user in rows]


def to_output(project: Project, db: Session, user: User, counts: tuple[int, int] | None = None) -> ProjectOut:
    permission = permission_for_project(db, project, user)
    if not permission:
        raise HTTPException(status_code=404, detail='Project not found.')
    if counts is None:
        counts = project_repository.counts_for_projects(db, [project.id]).get(project.id, (0, 0))
    owner = db.scalar(select(User).where(func.lower(User.username) == project.owner_username.lower()))
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description or '',
        start_date=project.start_date,
        due_date=project.due_date,
        project_manager=project.project_manager or '',
        state=project.state or 'open',
        priority=project.priority or 'medium',
        color=project.color,
        owner_username=project.owner_username,
        owner_display_name=_display_name(owner, project.owner_username),
        assignments=assignment_outputs(db, project.id),
        effective_access=permission.access,
        access_source=permission.source,
        is_new_assignment=permission.is_new,
        can_edit=permission.can_edit,
        can_run=permission.can_run,
        can_delete=permission.can_delete,
        can_manage_assignments=permission.can_manage_assignments and normalize_role(user.role) in {ROLE_ADMIN, ROLE_MANAGER},
        workflow_count=counts[0],
        dataset_count=counts[1],
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def list_projects(db: Session, user: User, *, limit: int, offset: int) -> list[ProjectOut]:
    projects = project_repository.list_accessible(db, user, limit=limit, offset=offset)
    counts = project_repository.counts_for_projects(db, [project.id for project in projects])
    outputs = [to_output(project, db, user, counts.get(project.id, (0, 0))) for project in projects]
    priority = {'assigned': 0, 'owned': 1, 'manager_visibility': 2, 'admin': 3}
    outputs.sort(key=lambda item: (0 if item.is_new_assignment else 1, priority.get(item.access_source, 4), -item.updated_at.timestamp()))
    return outputs


def _can_assign(user: User) -> bool:
    return normalize_role(user.role) in {ROLE_ADMIN, ROLE_MANAGER}


def _validate_and_apply_assignments(db: Session, project: Project, assignments: list, acting_user: User) -> None:
    if not _can_assign(acting_user):
        if assignments:
            raise HTTPException(status_code=403, detail='Only managers and admins can assign projects.')
        return
    target_ids = {item.user_id for item in assignments}
    users = {item.id: item for item in db.scalars(select(User).where(User.id.in_(target_ids))).all()} if target_ids else {}
    if len(users) != len(target_ids):
        raise HTTPException(status_code=400, detail='One or more selected users do not exist.')
    for item in assignments:
        target = users[item.user_id]
        if not target.is_active:
            raise HTTPException(status_code=400, detail=f'{target.username} is disabled.')
        if target.username.lower() == project.owner_username.lower():
            raise HTTPException(status_code=400, detail='The project owner cannot also be assigned.')
        if item.access_type == ACCESS_EDIT and normalize_role(target.role) != ROLE_EXPERT:
            raise HTTPException(status_code=400, detail='Edit access can only be assigned to expert users.')
    existing = {item.user_id: item for item in project_repository.assignments(db, project.id)}
    for user_id, row in existing.items():
        if user_id not in target_ids:
            db.delete(row)
    for item in assignments:
        row = existing.get(item.user_id)
        if row:
            if row.access_type != item.access_type:
                row.access_type = item.access_type
                row.is_new = True
                row.acknowledged_at = None
                row.assigned_at = datetime.utcnow()
                row.assigned_by_user_id = acting_user.id
        else:
            db.add(ProjectAssignment(project_id=project.id, user_id=item.user_id, access_type=item.access_type, assigned_by_user_id=acting_user.id, is_new=True))


def create_project(db: Session, payload: ProjectCreate, user: User) -> ProjectOut:
    if normalize_role(user.role) == ROLE_GUEST:
        raise HTTPException(status_code=403, detail='Guest users cannot create projects.')
    project = Project(
        name=payload.name.strip(), description=payload.description or '', start_date=payload.start_date, due_date=payload.due_date,
        project_manager=payload.project_manager or _display_name(user), state=payload.state, priority=payload.priority, color=payload.color,
        owner_username=user.username,
    )
    db.add(project); db.flush()
    _validate_and_apply_assignments(db, project, payload.assignments, user)
    db.commit(); db.refresh(project)
    return to_output(project, db, user, (0, 0))


def get_project(db: Session, project_id: int, user: User, *, acknowledge: bool = False) -> Project:
    project, permission = require_project_view(db, project_id, user)
    if acknowledge and permission.source == 'assigned' and permission.is_new:
        assignment = db.scalar(select(ProjectAssignment).where(ProjectAssignment.project_id == project_id, ProjectAssignment.user_id == user.id))
        if assignment:
            assignment.is_new = False
            assignment.acknowledged_at = datetime.utcnow()
            db.commit()
    return project


def update_project(db: Session, project_id: int, payload: ProjectUpdate, user: User) -> ProjectOut:
    project, permission = require_project_edit(db, project_id, user)
    project.name = payload.name.strip(); project.description = payload.description or ''
    project.start_date = payload.start_date; project.due_date = payload.due_date
    project.project_manager = payload.project_manager or ''; project.state = payload.state
    project.priority = payload.priority; project.color = payload.color
    if _can_assign(user):
        if not permission.can_manage_assignments:
            raise HTTPException(status_code=403, detail='Only the project owner or an admin can change project assignments.')
        _validate_and_apply_assignments(db, project, payload.assignments, user)
    else:
        existing_assignments = {(item.user_id, item.access_type) for item in project_repository.assignments(db, project.id)}
        submitted_assignments = {(item.user_id, item.access_type) for item in payload.assignments}
        if submitted_assignments != existing_assignments:
            raise HTTPException(status_code=403, detail='You cannot change project assignments.')
    db.commit(); db.refresh(project)
    return to_output(project, db, user)


def delete_project(db: Session, project_id: int, user: User) -> None:
    project, _ = require_project_delete(db, project_id, user)
    db.delete(project); db.commit()


def acknowledge_assignment(db: Session, project_id: int, user: User) -> None:
    require_project_view(db, project_id, user)
    assignment = db.scalar(select(ProjectAssignment).where(ProjectAssignment.project_id == project_id, ProjectAssignment.user_id == user.id))
    if assignment and assignment.is_new:
        assignment.is_new = False
        assignment.acknowledged_at = datetime.utcnow()
        db.commit()
