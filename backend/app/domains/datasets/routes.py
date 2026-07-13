from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.domains.datasets.repository import dataset_repository
from app.domains.datasets.schemas import DatasetOut
from app.domains.datasets.service import delete_dataset, get_dataset, read_dataset, upload_dataset
from app.services.users import get_current_user

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("/upload", response_model=DatasetOut)
def upload_dataset_route(
    file: UploadFile = File(...),
    project_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return upload_dataset(db, upload=file, project_id=project_id, owner_username=str(current_user["username"]))


@router.get("", response_model=list[DatasetOut])
def list_datasets(project_id: int | None = None, db: Session = Depends(get_db)):
    return dataset_repository.list(db, project_id)


@router.get("/{dataset_id}/preview")
def preview_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset = get_dataset(db, dataset_id)
    frame = read_dataset(db, dataset, max_rows=25)
    return {"columns": dataset.columns, "rows": frame.where(frame.notna(), None).to_dict(orient="records")}


@router.delete("/{dataset_id}")
def delete_dataset_route(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    delete_dataset(db, dataset_id, str(current_user["username"]))
    return {"ok": True}
