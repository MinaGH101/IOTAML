from __future__ import annotations

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import WorkflowComponent, WorkflowComponentVersion


class ComponentRepository:
    def list_accessible(self, db: Session, owner: str, project_id: int | None = None, include_archived: bool = False):
        query = db.query(WorkflowComponent).filter(
            or_(
                (WorkflowComponent.owner_username == owner) & (WorkflowComponent.visibility == "private"),
                WorkflowComponent.visibility == "organization",
                (WorkflowComponent.visibility == "project") & (WorkflowComponent.project_id == project_id),
            )
        )
        if not include_archived:
            query = query.filter(WorkflowComponent.archived.is_(False))
        return query.order_by(WorkflowComponent.updated_at.desc()).all()

    def get_accessible(self, db: Session, component_id: int, owner: str, project_id: int | None = None):
        return db.query(WorkflowComponent).filter(
            WorkflowComponent.id == component_id,
            or_(
                (WorkflowComponent.owner_username == owner) & (WorkflowComponent.visibility == "private"),
                WorkflowComponent.visibility == "organization",
                (WorkflowComponent.visibility == "project") & (WorkflowComponent.project_id == project_id),
            ),
        ).first()

    def get_owned(self, db: Session, component_id: int, owner: str):
        return db.query(WorkflowComponent).filter(
            WorkflowComponent.id == component_id,
            WorkflowComponent.owner_username == owner,
        ).first()

    def get_version(self, db: Session, component_id: int, version_id: int):
        return db.query(WorkflowComponentVersion).filter(
            WorkflowComponentVersion.id == version_id,
            WorkflowComponentVersion.component_id == component_id,
        ).first()

    def list_versions(self, db: Session, component_id: int):
        return db.query(WorkflowComponentVersion).filter(
            WorkflowComponentVersion.component_id == component_id
        ).order_by(WorkflowComponentVersion.version_number.desc()).all()


component_repository = ComponentRepository()
