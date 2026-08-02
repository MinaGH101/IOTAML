"""Project persistence and explicit user assignments."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utcnow_naive

ACCESS_EDIT = 'edit'
ACCESS_VIEW = 'view'
PROJECT_ACCESS_TYPES = {ACCESS_EDIT, ACCESS_VIEW}


class Project(Base):
    __tablename__ = 'projects'
    __table_args__ = (Index('ix_projects_owner_updated', 'owner_username', 'updated_at'),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default='')
    start_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    due_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    project_manager: Mapped[str] = mapped_column(String(255), nullable=False, default='')
    state: Mapped[str] = mapped_column(String(32), nullable=False, default='open')
    priority: Mapped[str] = mapped_column(String(32), nullable=False, default='medium')
    color: Mapped[str] = mapped_column(String(32), nullable=False, default='#31cde3')
    owner_username: Mapped[str] = mapped_column(String(320), nullable=False, default='admin', index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)


class ProjectAssignment(Base):
    __tablename__ = 'project_assignments'
    __table_args__ = (
        UniqueConstraint('project_id', 'user_id', name='uq_project_assignments_project_user'),
        Index('ix_project_assignments_user_new', 'user_id', 'is_new'),
        Index('ix_project_assignments_project_access', 'project_id', 'access_type'),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    access_type: Mapped[str] = mapped_column(String(16), nullable=False)
    assigned_by_user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    is_new: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow_naive)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
