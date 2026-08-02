"""Central project-level authorization used by all project resources."""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.auth.models import ROLE_ADMIN, ROLE_GUEST, ROLE_MANAGER, User
from app.domains.auth.service import normalize_role
from app.domains.projects.models import ACCESS_EDIT, ACCESS_VIEW, Project, ProjectAssignment


@dataclass(frozen=True)
class ProjectPermission:
    access: str
    source: str
    is_new: bool = False

    @property
    def can_view(self) -> bool:
        return True

    @property
    def can_edit(self) -> bool:
        return self.access in {'admin', 'owner', 'edit'}

    @property
    def can_run(self) -> bool:
        return self.can_edit

    @property
    def can_delete(self) -> bool:
        return self.access in {'admin', 'owner'}

    @property
    def can_manage_assignments(self) -> bool:
        return self.access in {'admin', 'owner'}


def permission_for_project(db: Session, project: Project, user: User) -> ProjectPermission | None:
    role = normalize_role(user.role)
    if project.owner_username.lower() == user.username.lower():
        return ProjectPermission('owner', 'owned')
    if role == ROLE_ADMIN:
        return ProjectPermission('admin', 'admin')
    # Managers have organization-wide read-only visibility outside projects they own.
    # Project assignments must never elevate that global manager policy.
    if role == ROLE_MANAGER:
        return ProjectPermission('view', 'manager_visibility')
    assignment = db.scalar(select(ProjectAssignment).where(ProjectAssignment.project_id == project.id, ProjectAssignment.user_id == user.id))
    if assignment:
        # A stale or manually edited assignment must never elevate a guest.
        access = ACCESS_VIEW if role == ROLE_GUEST else assignment.access_type
        return ProjectPermission(access, 'assigned', assignment.is_new)
    return None


def get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail='Project not found.')
    return project


def require_project_view(db: Session, project_id: int, user: User) -> tuple[Project, ProjectPermission]:
    project = get_project_or_404(db, project_id)
    permission = permission_for_project(db, project, user)
    if not permission:
        raise HTTPException(status_code=404, detail='Project not found.')
    return project, permission


def require_project_edit(db: Session, project_id: int, user: User) -> tuple[Project, ProjectPermission]:
    project, permission = require_project_view(db, project_id, user)
    if not permission.can_edit:
        raise HTTPException(status_code=403, detail='This project is read-only for your account.')
    return project, permission


def require_project_run(db: Session, project_id: int, user: User) -> tuple[Project, ProjectPermission]:
    project, permission = require_project_view(db, project_id, user)
    if not permission.can_run:
        raise HTTPException(status_code=403, detail='You cannot run workflows in this project.')
    return project, permission


def require_project_delete(db: Session, project_id: int, user: User) -> tuple[Project, ProjectPermission]:
    project, permission = require_project_view(db, project_id, user)
    if not permission.can_delete:
        raise HTTPException(status_code=403, detail='Only the project owner or an admin can delete this project.')
    return project, permission
