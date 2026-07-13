from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.domains.projects.repository import project_repository
from app.domains.projects.schemas import ProjectCreate, ProjectOut, ProjectUpdate
from app.models import Project


def to_output(project: Project, db: Session) -> ProjectOut:
    workflow_count, dataset_count = project_repository.counts(db, project.id)
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description or "",
        start_date=project.start_date,
        due_date=project.due_date,
        project_manager=project.project_manager or "",
        state=project.state or "open",
        priority=project.priority or "medium",
        color=project.color,
        owner_username=project.owner_username,
        workflow_count=workflow_count,
        dataset_count=dataset_count,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def create_project(db: Session, payload: ProjectCreate, current_user: dict) -> ProjectOut:
    project = Project(
        name=payload.name.strip(),
        description=payload.description or "",
        start_date=payload.start_date,
        due_date=payload.due_date,
        project_manager=payload.project_manager or f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
        state=payload.state,
        priority=payload.priority,
        color=payload.color,
        owner_username=str(current_user.get("username", "admin")),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return to_output(project, db)


def get_project(db: Session, project_id: int) -> Project:
    project = project_repository.get(db, project_id)
    if not project:
        raise NotFoundError("PROJECT_NOT_FOUND", "Project not found.", {"project_id": project_id})
    return project


def update_project(db: Session, project_id: int, payload: ProjectUpdate) -> ProjectOut:
    project = get_project(db, project_id)
    project.name = payload.name.strip()
    project.description = payload.description or ""
    project.start_date = payload.start_date
    project.due_date = payload.due_date
    project.project_manager = payload.project_manager or ""
    project.state = payload.state
    project.priority = payload.priority
    project.color = payload.color
    db.commit()
    db.refresh(project)
    return to_output(project, db)


def delete_project(db: Session, project_id: int) -> None:
    project = get_project(db, project_id)
    db.delete(project)
    db.commit()
