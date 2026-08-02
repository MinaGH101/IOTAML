"""Project API schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ProjectAccess = Literal['edit', 'view']
EffectiveProjectAccess = Literal['owner', 'edit', 'view', 'admin']


class ProjectAssignmentIn(BaseModel):
    user_id: int = Field(gt=0)
    access_type: ProjectAccess


class ProjectAssignmentOut(BaseModel):
    id: int
    user_id: int
    username: str
    display_name: str
    role: str
    access_type: ProjectAccess
    is_new: bool
    assigned_at: datetime


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(default='', max_length=10000)
    start_date: str | None = Field(default=None, max_length=32)
    due_date: str | None = Field(default=None, max_length=32)
    project_manager: str = Field(default='', max_length=255)
    state: str = Field(default='open', pattern='^(open|closed)$')
    priority: str = Field(default='medium', pattern='^(low|medium|high)$')
    color: str = Field(default='#31cde3', pattern='^#[0-9a-fA-F]{6}$')
    assignments: list[ProjectAssignmentIn] = Field(default_factory=list, max_length=100)

    @model_validator(mode='after')
    def validate_assignments(self):
        user_ids = [item.user_id for item in self.assignments]
        if len(user_ids) != len(set(user_ids)):
            raise ValueError('A user can only be assigned once per project.')
        if sum(1 for item in self.assignments if item.access_type == 'edit') > 1:
            raise ValueError('Only one user can receive edit access.')
        return self


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(ProjectBase):
    pass


class ProjectOut(ProjectBase):
    assignments: list[ProjectAssignmentOut] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_username: str
    owner_display_name: str = ''
    effective_access: EffectiveProjectAccess
    access_source: str = 'owned'
    is_new_assignment: bool = False
    can_edit: bool = False
    can_run: bool = False
    can_delete: bool = False
    can_manage_assignments: bool = False
    workflow_count: int = 0
    dataset_count: int = 0
    created_at: datetime
    updated_at: datetime
