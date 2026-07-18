from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    start_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    due_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    project_manager: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    priority: Mapped[str] = mapped_column(String(32), nullable=False, default="medium")
    color: Mapped[str] = mapped_column(String(32), nullable=False, default="#31cde3")
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, default="admin")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    columns: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    artifact_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False, default="text/csv")
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)


class Workflow(Base):
    __tablename__ = "workflows"
    __table_args__ = (
        Index("ix_workflows_owner_project_updated", "owner_username", "project_id", "updated_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    graph: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, default="admin", index=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    graph_hash: Mapped[str] = mapped_column(String(64), nullable=False, default="", index=True)
    last_run_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    last_autosaved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)


class WorkflowVersion(Base):
    __tablename__ = "workflow_versions"
    __table_args__ = (
        UniqueConstraint("workflow_id", "version_number", name="uq_workflow_versions_number"),
        Index("ix_workflow_versions_workflow_created", "workflow_id", "created_at"),
        Index("ix_workflow_versions_owner_workflow", "owner_username", "workflow_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    workflow_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    graph: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    graph_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    run_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)


class WorkflowComponent(Base):
    __tablename__ = "workflow_components"
    __table_args__ = (
        Index("ix_workflow_components_owner_updated", "owner_username", "updated_at"),
        Index("ix_workflow_components_scope", "visibility", "project_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String(120), nullable=False, default="Components")
    icon: Mapped[str] = mapped_column(String(64), nullable=False, default="workflow")
    visibility: Mapped[str] = mapped_column(String(32), nullable=False, default="private")
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    current_version_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)


class WorkflowComponentVersion(Base):
    __tablename__ = "workflow_component_versions"
    __table_args__ = (
        UniqueConstraint("component_id", "version_number", name="uq_workflow_component_version_number"),
        UniqueConstraint("component_id", "semantic_version", name="uq_workflow_component_semver"),
        Index("ix_workflow_component_versions_component_created", "component_id", "created_at"),
        Index("ix_workflow_component_versions_owner_component", "owner_username", "component_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    component_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    semantic_version: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    graph: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    graph_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    interface_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    exposed_parameters: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    dependencies_json: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    changelog: Mapped[str] = mapped_column(Text, nullable=False, default="")
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)


class Run(Base):
    __tablename__ = "runs"
    __table_args__ = (
        Index("ix_runs_queue_claim", "status", "priority", "next_attempt_at", "created_at"),
        Index("ix_runs_owner_status", "owner_username", "status"),
        Index("ix_runs_project_status", "project_id", "status"),
        Index("ix_runs_workflow_created", "workflow_id", "created_at"),
        UniqueConstraint("owner_username", "idempotency_key", name="uq_runs_owner_idempotency"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued", index=True)
    workflow_name: Mapped[str] = mapped_column(String(255), nullable=False, default="Untitled Run")
    workflow_graph: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    workflow_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    workflow_revision: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dataset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, default="admin", index=True)
    target_column: Mapped[str | None] = mapped_column(String(255), nullable=True)
    task_type: Mapped[str] = mapped_column(String(32), nullable=False, default="auto")
    bypass_cache: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=7200)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    locked_by: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    process_pid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    worker_exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cancel_requested: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    progress: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    node_statuses: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    logs: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    artifacts: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
    queued_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class CustomNode(Base):
    __tablename__ = "custom_nodes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    inputs: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    outputs: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    template: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)
