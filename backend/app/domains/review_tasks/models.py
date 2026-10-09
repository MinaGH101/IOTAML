"""Durable assignments for review, analysis, approval, and custom work."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utcnow_naive


class ReviewTask(Base):
    __tablename__ = 'review_tasks'
    __table_args__ = (
        UniqueConstraint('run_id', 'node_id', 'assignee_user_id', 'subject_id', name='uq_review_task_run_node_assignee_subject'),
        Index('ix_review_task_assignee_status', 'assignee_user_id', 'status', 'due_at'),
        Index('ix_review_task_project_case', 'project_id', 'case_id'),
        Index('uq_review_task_fingerprint', 'assignment_fingerprint', unique=True,
              postgresql_where=text("assignment_fingerprint <> ''"),
              sqlite_where=text("assignment_fingerprint <> ''")),
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
    assignment_group_id: Mapped[str] = mapped_column(String(64), nullable=False, default='')
    assignment_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, default='')
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    overdue_notified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow_naive)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class TaskSubmission(Base):
    """Immutable response envelope used by watchers and downstream workflows."""

    __tablename__ = 'task_submissions'
    __table_args__ = (Index('ix_task_submission_group_cursor', 'assignment_group_id', 'id'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey('review_tasks.id', ondelete='CASCADE'), nullable=False, unique=True)
    assignment_group_id: Mapped[str] = mapped_column(String(64), nullable=False)
    assignee_user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    answers_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow_naive)


class TaskSubmissionWatch(Base):
    """Durable cursor and fallback schedule for a Get Submissions node."""

    __tablename__ = 'task_submission_watches'
    __table_args__ = (
        UniqueConstraint('source_run_id', 'node_id', 'assignment_group_id', name='uq_task_watch_source_node_group'),
        Index('ix_task_watch_due', 'active', 'next_check_at'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    source_run_id: Mapped[int] = mapped_column(ForeignKey('runs.id', ondelete='CASCADE'), nullable=False)
    node_id: Mapped[str] = mapped_column(String(255), nullable=False)
    assignment_group_id: Mapped[str] = mapped_column(String(64), nullable=False)
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False)
    refresh_interval_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    last_submission_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    next_check_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow_naive)
    active: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow_naive)
