"""Dataset API schemas."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class ColumnInfo(BaseModel):
    name: str
    dtype: str
    missing: int
    unique: int

class DatasetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    filename: str
    columns: list[ColumnInfo]
    row_count: int
    project_id: int | None = None
    artifact_id: int | None = None
    content_type: str = 'text/csv'
    size_bytes: int = 0
    checksum_sha256: str | None = None
    created_at: datetime

class DatasetPreviewOut(BaseModel):
    columns: list[ColumnInfo]
    rows: list[dict]
    offset: int = 0
    limit: int
    total_rows: int
