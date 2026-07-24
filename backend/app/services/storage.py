from pathlib import Path
from uuid import uuid4
import pandas as pd
from fastapi import UploadFile
from app.config import get_settings


settings = get_settings()


def ensure_dirs() -> None:
    Path(settings.storage_dir, "datasets").mkdir(parents=True, exist_ok=True)
    Path(settings.storage_dir, "runs").mkdir(parents=True, exist_ok=True)
    Path(settings.storage_dir, "profile-images").mkdir(parents=True, exist_ok=True)


def ensure_storage_writable() -> None:
    """Fail startup early when the mounted runtime volume is not writable."""
    root = Path(settings.storage_dir)
    root.mkdir(parents=True, exist_ok=True)
    probe = root / f".iota-write-probe-{uuid4().hex}"
    try:
        probe.write_bytes(b"ok")
    except OSError as exc:
        raise RuntimeError(
            f"Runtime storage is not writable: {root}. "
            "Ensure the storage-init service completed successfully."
        ) from exc
    finally:
        probe.unlink(missing_ok=True)


def dataset_path(filename: str) -> str:
    safe_name = filename.replace("/", "_").replace("\\", "_")
    return str(Path(settings.storage_dir, "datasets", f"{uuid4().hex}_{safe_name}"))


async def save_upload(file: UploadFile) -> str:
    ensure_dirs()
    path = dataset_path(file.filename or "dataset.csv")
    with open(path, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            out.write(chunk)
    return path


def read_csv(path: str, max_rows: int | None = None) -> pd.DataFrame:
    if max_rows:
        return pd.read_csv(path, nrows=max_rows)
    return pd.read_csv(path)


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


def run_dir(run_id: int) -> Path:
    path = Path(settings.storage_dir, "runs", str(run_id))
    path.mkdir(parents=True, exist_ok=True)
    return path
