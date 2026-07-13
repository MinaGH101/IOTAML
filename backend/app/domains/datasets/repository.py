from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Dataset


class DatasetRepository:
    def get(self, db: Session, dataset_id: int) -> Dataset | None:
        return db.get(Dataset, dataset_id)

    def list(self, db: Session, project_id: int | None = None) -> list[Dataset]:
        query = db.query(Dataset)
        if project_id is not None:
            query = query.filter(Dataset.project_id == project_id)
        return query.order_by(Dataset.created_at.desc()).all()

    def add(self, db: Session, dataset: Dataset) -> Dataset:
        db.add(dataset)
        db.flush()
        return dataset


dataset_repository = DatasetRepository()
