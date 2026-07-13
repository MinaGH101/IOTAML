from __future__ import annotations

from pathlib import Path

import pandas as pd
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, ValidationAppError
from app.domains.artifacts.service import create_artifact_from_upload, delete_artifact, materialize_artifact
from app.domains.datasets.repository import dataset_repository
from app.models import Dataset


CSV_EXTENSIONS = {".csv"}
CSV_CONTENT_TYPES = {
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "application/octet-stream",
}


def column_info(df: pd.DataFrame) -> list[dict]:
    return [
        {
            "name": str(column),
            "dtype": str(df[column].dtype),
            "missing": int(df[column].isna().sum()),
            "unique": int(df[column].nunique(dropna=True)),
        }
        for column in df.columns
    ]


def materialize_dataset(db: Session, dataset: Dataset) -> Path:
    if dataset.artifact_id:
        return materialize_artifact(db, dataset.artifact_id, cache_group="datasets")
    path = Path(dataset.path)
    if not path.exists():
        raise NotFoundError("DATASET_FILE_NOT_FOUND", "Dataset file is unavailable.", {"dataset_id": dataset.id})
    return path


def read_dataset(db: Session, dataset: Dataset, max_rows: int | None = None) -> pd.DataFrame:
    path = materialize_dataset(db, dataset)
    try:
        return pd.read_csv(path, nrows=max_rows)
    except Exception as exc:
        raise ValidationAppError("DATASET_READ_FAILED", "Could not read the CSV dataset.", {"dataset_id": dataset.id}) from exc


def upload_dataset(db: Session, *, upload: UploadFile, project_id: int | None, owner_username: str) -> Dataset:
    artifact = create_artifact_from_upload(
        db,
        upload=upload,
        owner_username=owner_username,
        artifact_type="dataset",
        project_id=project_id,
        allowed_extensions=CSV_EXTENSIONS,
        allowed_content_types=CSV_CONTENT_TYPES,
    )
    try:
        path = materialize_artifact(db, artifact.id, cache_group="datasets")
        frame = pd.read_csv(path)
    except Exception as exc:
        delete_artifact(db, artifact.id, owner_username, force=True)
        db.commit()
        raise ValidationAppError("DATASET_READ_FAILED", "Could not read the uploaded CSV dataset.") from exc

    dataset = Dataset(
        name=artifact.original_filename,
        filename=artifact.original_filename,
        path=f"artifact://{artifact.id}",
        columns=column_info(frame),
        row_count=len(frame),
        project_id=project_id,
        artifact_id=artifact.id,
        content_type=artifact.content_type,
        size_bytes=artifact.size_bytes,
        checksum_sha256=artifact.checksum_sha256,
    )
    dataset_repository.add(db, dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


def get_dataset(db: Session, dataset_id: int) -> Dataset:
    dataset = dataset_repository.get(db, dataset_id)
    if not dataset:
        raise NotFoundError("DATASET_NOT_FOUND", "Dataset not found.", {"dataset_id": dataset_id})
    return dataset


def delete_dataset(db: Session, dataset_id: int, owner_username: str) -> None:
    dataset = get_dataset(db, dataset_id)
    artifact_id = dataset.artifact_id
    legacy_path = Path(dataset.path) if not dataset.path.startswith("artifact://") else None
    db.delete(dataset)
    db.flush()
    if artifact_id:
        delete_artifact(db, artifact_id, owner_username, force=True)
    elif legacy_path and legacy_path.exists():
        legacy_path.unlink(missing_ok=True)
    db.commit()
