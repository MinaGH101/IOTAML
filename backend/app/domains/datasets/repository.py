"""Ownership-scoped dataset persistence queries."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.datasets.models import Dataset


class DatasetRepository:
    def get(self, db: Session, dataset_id: int, owner_username: str | None = None) -> Dataset | None:
        query = select(Dataset).where(Dataset.id == dataset_id)
        if owner_username is not None:
            query = query.where(Dataset.owner_username == owner_username)
        return db.execute(query).scalar_one_or_none()

    def list(self, db: Session, owner_username: str, project_id: int | None = None, *, limit: int = 50, offset: int = 0) -> list[Dataset]:
        query = select(Dataset).where(Dataset.owner_username == owner_username)
        if project_id is not None:
            query = query.where(Dataset.project_id == project_id)
        return list(db.execute(
            query.order_by(Dataset.created_at.desc(), Dataset.id.desc()).offset(max(0, offset)).limit(limit)
        ).scalars().all())

    def add(self, db: Session, dataset: Dataset) -> Dataset:
        db.add(dataset); db.flush(); return dataset


dataset_repository = DatasetRepository()
