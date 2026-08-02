"""Run queue API schemas."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
class RunCreate(BaseModel):
    workflow_name: str = Field(default='Untitled Run', min_length=1, max_length=255)
    workflow_graph: dict
    workflow_id: int | None = None
    workflow_revision: int | None = None
    dataset_id: int | None = None
    project_id: int | None = None
    target_column: str | None = None
    task_type: str = 'auto'
    selected_node_id: str | None = None
    priority: int = Field(default=0, ge=-100, le=100)
    max_attempts: int | None = Field(default=None, ge=1, le=10)
    timeout_seconds: int | None = Field(default=None, ge=10, le=86400)
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=128)
    bypass_cache: bool = False
class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
    workflow_name: str
    workflow_graph: dict
    workflow_id: int | None
    workflow_revision: int | None
    dataset_id: int | None
    project_id: int | None = None
    owner_username: str
    target_column: str | None
    task_type: str
    selected_node_id: str | None = None
    bypass_cache: bool
    priority: int
    attempts: int
    max_attempts: int
    timeout_seconds: int
    cancel_requested: bool
    locked_by: str | None
    heartbeat_at: datetime | None
    process_pid: int | None
    progress: dict | None
    node_statuses: dict | None
    logs: list[dict] | None
    metrics: dict | None
    artifacts: dict | None
    error: str | None
    failure_code: str | None = None
    failure_retryable: bool | None = None
    created_at: datetime
    queued_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
class RunSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
    workflow_name: str
    project_id: int | None = None
    attempts: int
    max_attempts: int
    cancel_requested: bool
    progress: dict | None
    error: str | None
    created_at: datetime
    queued_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
