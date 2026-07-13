from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Dataset, Project, Workflow


class ProjectRepository:
    def get(self, db: Session, project_id: int) -> Project | None:
        return db.get(Project, project_id)

    def list(self, db: Session) -> list[Project]:
        return db.query(Project).order_by(Project.updated_at.desc()).all()

    def counts(self, db: Session, project_id: int) -> tuple[int, int]:
        workflows = db.query(Workflow).filter(Workflow.project_id == project_id).count()
        datasets = db.query(Dataset).filter(Dataset.project_id == project_id).count()
        return workflows, datasets


project_repository = ProjectRepository()
