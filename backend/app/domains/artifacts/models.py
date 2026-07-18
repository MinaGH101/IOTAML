from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, DateTime, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Artifact(Base):
    __tablename__ = "artifacts"
    __table_args__ = (
        Index("ix_artifacts_owner_status", "owner_username", "status"),
        Index("ix_artifacts_project_type", "project_id", "artifact_type"),
        Index("ix_artifacts_run_node", "run_id", "node_id"),
        Index("ix_artifacts_expires_at", "expires_at"),
        Index("ix_artifacts_version", "owner_username", "project_id", "artifact_type", "logical_name", "version"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    workflow_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    run_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    node_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    artifact_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    storage_backend: Mapped[str] = mapped_column(String(32), nullable=False)
    bucket: Mapped[str | None] = mapped_column(String(255), nullable=True)
    object_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    logical_name: Mapped[str] = mapped_column(String(512), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    parent_artifact_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False, default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    cache_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    schema_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="available", index=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ArtifactLineage(Base):
    __tablename__ = "artifact_lineage"
    __table_args__ = (
        UniqueConstraint("parent_artifact_id", "child_artifact_id", "input_name", name="uq_artifact_lineage_edge"),
        Index("ix_artifact_lineage_child", "child_artifact_id"),
        Index("ix_artifact_lineage_parent", "parent_artifact_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parent_artifact_id: Mapped[int] = mapped_column(Integer, nullable=False)
    child_artifact_id: Mapped[int] = mapped_column(Integer, nullable=False)
    input_name: Mapped[str] = mapped_column(String(255), nullable=False, default="input")
    source_node_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    target_node_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)


class NodeCacheEntry(Base):
    __tablename__ = "node_cache_entries"
    __table_args__ = (
        UniqueConstraint("owner_username", "project_id", "cache_key", name="uq_node_cache_scope_key"),
        Index("ix_node_cache_lookup", "owner_username", "project_id", "static_fingerprint", "status"),
        Index("ix_node_cache_lru", "status", "pinned", "last_accessed_at"),
        Index("ix_node_cache_artifact", "artifact_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    workflow_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    source_run_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    node_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    node_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    node_version: Mapped[str] = mapped_column(String(64), nullable=False)
    static_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    cache_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    output_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    artifact_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    hit_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="available", index=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_accessed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)


class NodeExecution(Base):
    __tablename__ = "node_executions"
    __table_args__ = (
        UniqueConstraint("run_id", "node_id", name="uq_node_execution_run_node"),
        Index("ix_node_executions_run", "run_id"),
        Index("ix_node_executions_cache", "cache_key"),
        Index("ix_node_executions_artifact", "artifact_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    run_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    workflow_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    node_id: Mapped[str] = mapped_column(String(255), nullable=False)
    node_type: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    cache_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cache_hit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cache_entry_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    artifact_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_digest: Mapped[str | None] = mapped_column(String(64), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
