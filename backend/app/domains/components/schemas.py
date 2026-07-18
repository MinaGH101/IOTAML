from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ComponentPort(BaseModel):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z][A-Za-z0-9_-]*$")
    name: str = Field(min_length=1, max_length=120)
    type: str = Field(default="any", min_length=1, max_length=64)
    required: bool = True
    multiple: bool = False
    internal_node_id: str = Field(min_length=1, max_length=255)
    internal_handle: str = Field(default="input", min_length=1, max_length=128)


class ExposedComponentParameter(BaseModel):
    id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z][A-Za-z0-9_.-]*$")
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=1000)
    type: str = Field(default="text", max_length=64)
    default: object | None = None
    required: bool = False
    options: list[object] = Field(default_factory=list)
    internal_node_id: str = Field(min_length=1, max_length=255)
    internal_param: str = Field(min_length=1, max_length=128)


class ComponentInterface(BaseModel):
    inputs: list[ComponentPort] = Field(default_factory=list)
    outputs: list[ComponentPort] = Field(default_factory=list)

    @model_validator(mode="after")
    def unique_ids(self):
        for ports, label in ((self.inputs, "input"), (self.outputs, "output")):
            ids = [port.id for port in ports]
            if len(ids) != len(set(ids)):
                raise ValueError(f"Duplicate component {label} port IDs are not allowed.")
        return self


class ComponentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=4000)
    category: str = Field(default="Components", min_length=1, max_length=120)
    icon: str = Field(default="workflow", max_length=64)
    visibility: Literal["private", "project", "organization"] = "private"
    project_id: int | None = None
    semantic_version: str = Field(default="1.0.0", pattern=r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$")
    graph: dict
    interface: ComponentInterface
    exposed_parameters: list[ExposedComponentParameter] = Field(default_factory=list)
    changelog: str = Field(default="Initial component", max_length=4000)


class ComponentVersionCreate(BaseModel):
    semantic_version: str = Field(pattern=r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$")
    graph: dict
    interface: ComponentInterface
    exposed_parameters: list[ExposedComponentParameter] = Field(default_factory=list)
    changelog: str = Field(default="", max_length=4000)


class ComponentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    category: str | None = Field(default=None, min_length=1, max_length=120)
    icon: str | None = Field(default=None, max_length=64)
    visibility: Literal["private", "project", "organization"] | None = None
    project_id: int | None = None
    archived: bool | None = None


class ComponentVersionOut(BaseModel):
    id: int
    component_id: int
    version_number: int
    semantic_version: str
    name: str
    description: str
    graph: dict
    graph_hash: str
    interface_json: dict
    exposed_parameters: list[dict]
    dependencies_json: list[dict]
    changelog: str
    owner_username: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ComponentVersionSummaryOut(BaseModel):
    id: int
    component_id: int
    version_number: int
    semantic_version: str
    graph_hash: str
    changelog: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ComponentOut(BaseModel):
    id: int
    name: str
    description: str
    category: str
    icon: str
    visibility: str
    project_id: int | None
    owner_username: str
    current_version_id: int | None
    archived: bool
    created_at: datetime
    updated_at: datetime
    current_version: ComponentVersionOut | None = None
    usage_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ComponentImportPackage(BaseModel):
    format: Literal["iota-workflow-component-v1"]
    component: dict
    version: dict
    source_component_id: int | None = None
    source_version_id: int | None = None
    dependencies: list[dict] = Field(default_factory=list)
