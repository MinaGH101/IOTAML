from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Dataset
from app.schemas import DatasetOut
from app.services.storage import column_info, read_csv, save_upload

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("/upload", response_model=DatasetOut)
async def upload_dataset(file: UploadFile = File(...), project_id: int | None = Form(default=None), db: Session = Depends(get_db)) -> Dataset:
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported in this MVP.")
    path = await save_upload(file)
    try:
        df = read_csv(path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {exc}") from exc

    dataset = Dataset(
        name=file.filename or "dataset.csv",
        filename=file.filename or "dataset.csv",
        path=path,
        columns=column_info(df),
        row_count=len(df),
        project_id=project_id,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


@router.get("", response_model=list[DatasetOut])
def list_datasets(project_id: int | None = None, db: Session = Depends(get_db)) -> list[Dataset]:
    query = db.query(Dataset)
    if project_id is not None:
        query = query.filter(Dataset.project_id == project_id)
    return query.order_by(Dataset.created_at.desc()).all()


@router.get("/{dataset_id}/preview")
def preview_dataset(dataset_id: int, db: Session = Depends(get_db)) -> dict:
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    df = read_csv(dataset.path, max_rows=25)
    return {"columns": dataset.columns, "rows": df.where(df.notna(), None).to_dict(orient="records")}


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)) -> dict:
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    path = Path(dataset.path)
    db.delete(dataset)
    db.commit()
    try:
        if path.exists():
            path.unlink()
    except Exception:
        pass
    return {"ok": True}
