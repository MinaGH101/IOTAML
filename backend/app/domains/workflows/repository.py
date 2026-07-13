from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Workflow


class WorkflowRepository:
    def get(self, db: Session, workflow_id: int) -> Workflow | None:
        return db.get(Workflow, workflow_id)

    def list(self, db: Session, project_id: int | None = None) -> list[Workflow]:
        query = db.query(Workflow)
        if project_id is not None:
            query = query.filter(Workflow.project_id == project_id)
        return query.order_by(Workflow.updated_at.desc()).all()


workflow_repository = WorkflowRepository()
