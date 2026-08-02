"""Reusable workflow-component persistence models."""
from __future__ import annotations
from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.core.time import utcnow_naive

class WorkflowComponent(Base):
    __tablename__ = 'workflow_components'
    __table_args__ = (Index('ix_workflow_components_owner_updated', 'owner_username', 'updated_at'), Index('ix_workflow_components_scope', 'visibility', 'project_id'))
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default='')
    category: Mapped[str] = mapped_column(String(120), nullable=False, default='Components')
    icon: Mapped[str] = mapped_column(String(64), nullable=False, default='workflow')
    visibility: Mapped[str] = mapped_column(String(32), nullable=False, default='private')
    project_id: Mapped[int | None] = mapped_column(ForeignKey('projects.id', ondelete='SET NULL'), nullable=True, index=True)
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    current_version_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)

class WorkflowComponentVersion(Base):
    __tablename__ = 'workflow_component_versions'
    __table_args__ = (
        UniqueConstraint('component_id', 'version_number', name='uq_workflow_component_version_number'),
        UniqueConstraint('component_id', 'semantic_version', name='uq_workflow_component_semver'),
        Index('ix_workflow_component_versions_component_created', 'component_id', 'created_at'),
        Index('ix_workflow_component_versions_owner_component', 'owner_username', 'component_id'),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    component_id: Mapped[int] = mapped_column(ForeignKey('workflow_components.id', ondelete='CASCADE'), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    semantic_version: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default='')
    graph: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    graph_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    interface_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    exposed_parameters: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    dependencies_json: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    changelog: Mapped[str] = mapped_column(Text, nullable=False, default='')
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
