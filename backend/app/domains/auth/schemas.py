"""Authentication, profile, and admin-user schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

UserRole = Literal['admin', 'manager', 'expert', 'guest']


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=320)
    password: str = Field(min_length=1, max_length=255)


class UserProfile(BaseModel):
    id: int
    username: str
    first_name: str = ''
    last_name: str = ''
    phone_number: str = ''
    email: str = ''
    role: UserRole = 'expert'
    access_level: str = 'Expert'
    profile_image: str = ''
    title: str = ''
    department: str = ''
    activity: list[dict] = Field(default_factory=list)
    alarms: list[dict] = Field(default_factory=list)
    notifications: list[dict] = Field(default_factory=list)
    is_active: bool = True


class UserProfileUpdate(BaseModel):
    first_name: str = Field(default='', max_length=255)
    last_name: str = Field(default='', max_length=255)
    phone_number: str = Field(default='', max_length=64)
    email: str = Field(default='', max_length=320)
    profile_image: str = Field(default='', max_length=1024)
    title: str = Field(default='', max_length=255)
    department: str = Field(default='', max_length=255)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=255)
    new_password: str = Field(min_length=10, max_length=255)


class LoginOut(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    user: UserProfile


class AdminUserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=320)
    email: str = Field(default='', max_length=320)
    password: str = Field(min_length=10, max_length=255)
    first_name: str = Field(default='', max_length=255)
    last_name: str = Field(default='', max_length=255)
    phone_number: str = Field(default='', max_length=64)
    title: str = Field(default='', max_length=255)
    department: str = Field(default='', max_length=255)
    role: UserRole = 'expert'
    is_active: bool = True


class AdminUserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=320)
    email: str | None = Field(default=None, max_length=320)
    password: str | None = Field(default=None, min_length=10, max_length=255)
    first_name: str | None = Field(default=None, max_length=255)
    last_name: str | None = Field(default=None, max_length=255)
    phone_number: str | None = Field(default=None, max_length=64)
    title: str | None = Field(default=None, max_length=255)
    department: str | None = Field(default=None, max_length=255)
    role: UserRole | None = None
    is_active: bool | None = None


class AdminUserOut(UserProfile):
    model_config = ConfigDict(from_attributes=True)
    created_at: datetime
    updated_at: datetime
    owned_project_count: int = 0
    assigned_project_count: int = 0
