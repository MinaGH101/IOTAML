"""Workflow API schemas."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class WorkflowCreate(BaseModel):
    name: str = Field(default='Untitled Workflow', min_length=1, max_length=255)
    graph: dict
    project_id: int | None = None
    last_run_id: int | None = None
class WorkflowAutosaveIn(WorkflowCreate):
    base_revision: int | None = Field(default=None, ge=1)
    client_graph_hash: str | None = Field(default=None, min_length=64, max_length=64)
class WorkflowRenameIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
class WorkflowOut(WorkflowCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_username: str
    revision: int
    graph_hash: str
    last_autosaved_at: datetime | None
    created_at: datetime
    updated_at: datetime
class WorkflowVersionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default='', max_length=2000)
    run_id: int | None = None
class WorkflowVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
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
class WorkflowVersionSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    workflow_id: int
    version_number: int
    name: str
    description: str
    graph_hash: str
    source_revision: int
    run_id: int | None
    created_at: datetime
