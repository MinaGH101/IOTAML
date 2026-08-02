"""Durable run queue, attempts, and bounded event persistence models."""
from __future__ import annotations
from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.core.time import utcnow_naive

class Run(Base):
    __tablename__ = 'runs'
    __table_args__ = (
        Index('ix_runs_queue_claim', 'status', 'priority', 'next_attempt_at', 'created_at'),
        Index('ix_runs_owner_status', 'owner_username', 'status'),
        Index('ix_runs_project_status', 'project_id', 'status'),
        Index('ix_runs_workflow_created', 'workflow_id', 'created_at'),
        UniqueConstraint('owner_username', 'idempotency_key', name='uq_runs_owner_idempotency'),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='queued', index=True)
    workflow_name: Mapped[str] = mapped_column(String(255), nullable=False, default='Untitled Run')
    workflow_graph: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    workflow_id: Mapped[int | None] = mapped_column(ForeignKey('workflows.id', ondelete='SET NULL'), nullable=True, index=True)
    workflow_revision: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dataset_id: Mapped[int | None] = mapped_column(ForeignKey('datasets.id', ondelete='SET NULL'), nullable=True, index=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey('projects.id', ondelete='SET NULL'), nullable=True, index=True)
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, default='admin', index=True)
    target_column: Mapped[str | None] = mapped_column(String(255), nullable=True)
    task_type: Mapped[str] = mapped_column(String(32), nullable=False, default='auto')
    selected_node_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bypass_cache: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=7200)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    locked_by: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    process_pid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    worker_exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cancel_requested: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    failure_code: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    failure_retryable: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    dead_lettered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    progress: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    node_statuses: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    logs: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    artifacts: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
    queued_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

class RunAttempt(Base):
    __tablename__ = 'run_attempts'
    __table_args__ = (UniqueConstraint('run_id', 'attempt_number', name='uq_run_attempt_number'), Index('ix_run_attempts_status_created', 'status', 'created_at'))
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey('runs.id', ondelete='CASCADE'), nullable=False, index=True)
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    worker_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    error_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retryable: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)

class RunEvent(Base):
    __tablename__ = 'run_events'
    __table_args__ = (Index('ix_run_events_run_sequence', 'run_id', 'sequence'),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey('runs.id', ondelete='CASCADE'), nullable=False, index=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    level: Mapped[str] = mapped_column(String(16), nullable=False, default='info')
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    node_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
