"""Workflow and immutable workflow-version persistence models."""
from __future__ import annotations
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.core.time import utcnow_naive

class Workflow(Base):
    __tablename__ = 'workflows'
    __table_args__ = (Index('ix_workflows_owner_project_updated', 'owner_username', 'project_id', 'updated_at'),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    graph: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    project_id: Mapped[int | None] = mapped_column(ForeignKey('projects.id', ondelete='SET NULL'), nullable=True, index=True)
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, default='admin', index=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    graph_hash: Mapped[str] = mapped_column(String(64), nullable=False, default='', index=True)
    last_run_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    last_autosaved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)

class WorkflowVersion(Base):
    __tablename__ = 'workflow_versions'
    __table_args__ = (
        UniqueConstraint('workflow_id', 'version_number', name='uq_workflow_versions_number'),
        Index('ix_workflow_versions_workflow_created', 'workflow_id', 'created_at'),
        Index('ix_workflow_versions_owner_workflow', 'owner_username', 'workflow_id'),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    workflow_id: Mapped[int] = mapped_column(ForeignKey('workflows.id', ondelete='CASCADE'), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default='')
    graph: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    graph_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    run_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
