from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ArtifactOut(BaseModel):
    id: int
    project_id: int | None
    workflow_id: int | None
    run_id: int | None
    node_id: str | None
    owner_username: str
    artifact_type: str
    storage_backend: str
    original_filename: str
    logical_name: str
    version: int
    parent_artifact_id: int | None
    content_type: str
    size_bytes: int
    checksum_sha256: str
    status: str
    expires_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class ArtifactDownloadOut(BaseModel):
    artifact_id: int
    url: str
    expires_in_seconds: int


class ArtifactUsageOut(BaseModel):
    project_id: int | None = None
    total_bytes: int
    quota_bytes: int
    artifact_count: int
    by_type: dict[str, int]
