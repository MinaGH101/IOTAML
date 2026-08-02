"""Validated API models for workflow graphs and validation diagnostics."""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field

class WorkflowPort(BaseModel):
    id: str
    name: str | None = None
    type: str = 'any'
    required: bool = True
    multiple: bool = False

class WorkflowNode(BaseModel):
    id: str
    type: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)

class WorkflowEdge(BaseModel):
    id: str | None = None
    source: str
    target: str
    sourceHandle: str | None = None
    targetHandle: str | None = None

class WorkflowGraph(BaseModel):
    nodes: list[WorkflowNode] = Field(default_factory=list)
    edges: list[WorkflowEdge] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)

class ValidationMessage(BaseModel):
    level: Literal['error','warning'] = 'error'
    nodeId: str | None = None
    edgeId: str | None = None
    type: str
    message: str
    suggestedFix: str | None = None
    responsibility: Literal['user', 'application'] = 'user'
    field: str | None = None
    port: str | None = None
    expected: Any = None
    actual: Any = None
    details: dict[str, Any] = Field(default_factory=dict)

class ValidationResult(BaseModel):
    valid: bool
    errors: list[ValidationMessage] = Field(default_factory=list)
    warnings: list[ValidationMessage] = Field(default_factory=list)
