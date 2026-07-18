from datetime import datetime
from pydantic import BaseModel, Field


class ColumnInfo(BaseModel):
    name: str
    dtype: str
    missing: int
    unique: int


class DatasetOut(BaseModel):
    id: int
    name: str
    filename: str
    columns: list[ColumnInfo]
    row_count: int
    project_id: int | None = None
    artifact_id: int | None = None
    content_type: str = "text/csv"
    size_bytes: int = 0
    checksum_sha256: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class WorkflowCreate(BaseModel):
    name: str = Field(default="Untitled Workflow", min_length=1, max_length=255)
    graph: dict
    project_id: int | None = None
    last_run_id: int | None = None


class WorkflowAutosaveIn(WorkflowCreate):
    base_revision: int | None = Field(default=None, ge=1)
    client_graph_hash: str | None = Field(default=None, min_length=64, max_length=64)


class WorkflowRenameIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class WorkflowOut(WorkflowCreate):
    id: int
    owner_username: str
    revision: int
    graph_hash: str
    last_autosaved_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkflowVersionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    run_id: int | None = None


class WorkflowVersionOut(BaseModel):
    id: int
    workflow_id: int
    version_number: int
    name: str
    description: str
    graph: dict
    graph_hash: str
    source_revision: int
    run_id: int | None
    owner_username: str
    created_at: datetime

    class Config:
        from_attributes = True


class WorkflowVersionSummaryOut(BaseModel):
    id: int
    workflow_id: int
    version_number: int
    name: str
    description: str
    graph_hash: str
    source_revision: int
    run_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class RunCreate(BaseModel):
    workflow_name: str = Field(default="Untitled Run", min_length=1, max_length=255)
    workflow_graph: dict
    workflow_id: int | None = None
    workflow_revision: int | None = None
    dataset_id: int | None = None
    project_id: int | None = None
    target_column: str | None = None
    task_type: str = "auto"
    priority: int = Field(default=0, ge=-100, le=100)
    max_attempts: int | None = Field(default=None, ge=1, le=10)
    timeout_seconds: int | None = Field(default=None, ge=10, le=86400)
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=128)
    bypass_cache: bool = False


class RunOut(BaseModel):
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
    created_at: datetime
    queued_at: datetime
    started_at: datetime | None
    finished_at: datetime | None

    class Config:
        from_attributes = True


class RunSummaryOut(BaseModel):
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

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    start_date: str | None = None
    due_date: str | None = None
    project_manager: str = ""
    state: str = Field(default="open", pattern="^(open|closed)$")
    priority: str = Field(default="medium", pattern="^(low|medium|high)$")
    color: str = Field(default="#31cde3", pattern="^#[0-9a-fA-F]{6}$")


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(ProjectBase):
    pass


class ProjectOut(ProjectBase):
    id: int
    owner_username: str
    workflow_count: int = 0
    dataset_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=255)


class UserProfile(BaseModel):
    username: str
    first_name: str = ""
    last_name: str = ""
    phone_number: str = ""
    email: str = ""
    access_level: str = "Viewer"
    profile_image: str = ""
    title: str = ""
    department: str = ""
    activity: list[dict] = []
    alarms: list[dict] = []
    notifications: list[dict] = []


class UserProfileUpdate(BaseModel):
    first_name: str = ""
    last_name: str = ""
    phone_number: str = ""
    email: str = ""
    profile_image: str = ""
    title: str = ""
    department: str = ""


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile


class CustomPortIn(BaseModel):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z][A-Za-z0-9_-]*$")
    name: str = Field(min_length=1, max_length=120)
    type: str = Field(default="any", min_length=1, max_length=64)
    required: bool = True
    multiple: bool = False


class CustomNodeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    inputs: list[CustomPortIn] = Field(default_factory=list)
    outputs: list[CustomPortIn] = Field(default_factory=lambda: [CustomPortIn(id="output", name="Output", type="json", required=False)])
    code: str = Field(min_length=1, max_length=100000)
    template: dict | None = None


class CustomNodeOut(CustomNodeCreate):
    id: str
    owner_username: str
    category: str = "User Nodes"
    executionMode: str = "sandboxed"
    isCustom: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
