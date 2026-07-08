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
    created_at: datetime

    class Config:
        from_attributes = True


class WorkflowCreate(BaseModel):
    name: str = Field(default="Untitled Workflow", min_length=1, max_length=255)
    graph: dict
    project_id: int | None = None


class WorkflowOut(WorkflowCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RunCreate(BaseModel):
    workflow_name: str = "Untitled Run"
    workflow_graph: dict
    dataset_id: int | None = None
    project_id: int | None = None
    target_column: str | None = None
    task_type: str = "auto"


class RunOut(BaseModel):
    id: int
    status: str
    workflow_name: str
    workflow_graph: dict
    dataset_id: int | None
    project_id: int | None = None
    target_column: str | None
    task_type: str
    metrics: dict | None
    artifacts: dict | None
    error: str | None
    created_at: datetime
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
