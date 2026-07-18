from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Workflow, WorkflowVersion


class WorkflowRepository:
    def get(self, db: Session, workflow_id: int, owner_username: str | None = None) -> Workflow | None:
        query = db.query(Workflow).filter(Workflow.id == workflow_id)
        if owner_username is not None:
            query = query.filter(Workflow.owner_username == owner_username)
        return query.first()

    def get_for_update(self, db: Session, workflow_id: int, owner_username: str) -> Workflow | None:
        return (
            db.query(Workflow)
            .filter(Workflow.id == workflow_id, Workflow.owner_username == owner_username)
            .with_for_update()
            .first()
        )

    def list(self, db: Session, project_id: int | None = None, owner_username: str | None = None) -> list[Workflow]:
        query = db.query(Workflow)
        if owner_username is not None:
            query = query.filter(Workflow.owner_username == owner_username)
        if project_id is not None:
            query = query.filter(Workflow.project_id == project_id)
        return query.order_by(Workflow.updated_at.desc()).all()

    def list_versions(self, db: Session, workflow_id: int, owner_username: str) -> list[WorkflowVersion]:
        return (
            db.query(WorkflowVersion)
            .filter(WorkflowVersion.workflow_id == workflow_id, WorkflowVersion.owner_username == owner_username)
            .order_by(WorkflowVersion.version_number.desc())
            .all()
        )

    def get_version(self, db: Session, workflow_id: int, version_id: int, owner_username: str) -> WorkflowVersion | None:
        return (
            db.query(WorkflowVersion)
            .filter(
                WorkflowVersion.id == version_id,
                WorkflowVersion.workflow_id == workflow_id,
                WorkflowVersion.owner_username == owner_username,
            )
            .first()
        )


workflow_repository = WorkflowRepository()
