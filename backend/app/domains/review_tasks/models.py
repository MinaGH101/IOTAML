"""Durable assignments for review, analysis, approval, and custom work."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utcnow_naive


class ReviewTask(Base):
    __tablename__ = 'review_tasks'
    __table_args__ = (
        UniqueConstraint('run_id', 'node_id', 'assignee_user_id', 'subject_id', name='uq_review_task_run_node_assignee_subject'),
        Index('ix_review_task_assignee_status', 'assignee_user_id', 'status', 'due_at'),
        Index('ix_review_task_project_case', 'project_id', 'case_id'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    run_id: Mapped[int] = mapped_column(ForeignKey('runs.id', ondelete='CASCADE'), nullable=False)
    node_id: Mapped[str] = mapped_column(String(255), nullable=False)
    case_id: Mapped[str] = mapped_column(String(128), nullable=False)
    form_id: Mapped[str] = mapped_column(String(64), nullable=False)
    task_kind: Mapped[str] = mapped_column(String(20), nullable=False, default='review')
    instructions: Mapped[str] = mapped_column(String(4000), nullable=False, default='')
    subject_type: Mapped[str] = mapped_column(String(32), nullable=False, default='case')
    subject_id: Mapped[str] = mapped_column(String(128), nullable=False, default='')
    assignee_user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default='open')
    form_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    case_summary: Mapped[dict] = mapped_column(JSON, nullable=False)
    response_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow_naive)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
