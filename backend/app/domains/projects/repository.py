"""Project and assignment persistence queries."""
from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.domains.auth.models import ROLE_ADMIN, ROLE_MANAGER, User
from app.domains.auth.service import normalize_role
from app.domains.datasets.models import Dataset
from app.domains.projects.models import Project, ProjectAssignment
from app.domains.workflows.models import Workflow


class ProjectRepository:
    def get(self, db: Session, project_id: int) -> Project | None:
        return db.get(Project, project_id)

    def list_accessible(self, db: Session, user: User, *, limit: int = 200, offset: int = 0) -> list[Project]:
        role = normalize_role(user.role)
        statement = select(Project)
        if role not in {ROLE_ADMIN, ROLE_MANAGER}:
            assigned = select(ProjectAssignment.project_id).where(ProjectAssignment.user_id == user.id)
            statement = statement.where(or_(func.lower(Project.owner_username) == user.username.lower(), Project.id.in_(assigned)))
        return list(db.scalars(statement.order_by(Project.updated_at.desc(), Project.id.desc()).offset(max(0, offset)).limit(limit)).all())

    def counts_for_projects(self, db: Session, project_ids: list[int]) -> dict[int, tuple[int, int]]:
        if not project_ids:
            return {}
        workflow_counts = dict(db.execute(select(Workflow.project_id, func.count(Workflow.id)).where(Workflow.project_id.in_(project_ids)).group_by(Workflow.project_id)).all())
        dataset_counts = dict(db.execute(select(Dataset.project_id, func.count(Dataset.id)).where(Dataset.project_id.in_(project_ids)).group_by(Dataset.project_id)).all())
        return {project_id: (int(workflow_counts.get(project_id, 0)), int(dataset_counts.get(project_id, 0))) for project_id in project_ids}

    def assignments(self, db: Session, project_id: int) -> list[ProjectAssignment]:
        return list(db.scalars(select(ProjectAssignment).where(ProjectAssignment.project_id == project_id).order_by(ProjectAssignment.access_type, ProjectAssignment.assigned_at)).all())


project_repository = ProjectRepository()
