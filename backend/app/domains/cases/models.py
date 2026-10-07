from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utcnow_naive


class CaseRecord(Base):
    __tablename__ = 'case_records'
    __table_args__ = (
        UniqueConstraint('project_id', 'case_id', name='uq_case_records_project_case'),
        Index('ix_case_records_project_status_score', 'project_id', 'status', 'score_total'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True)
    case_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    fields_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    primary_artifact_id: Mapped[int] = mapped_column(ForeignKey('artifacts.id', ondelete='RESTRICT'), nullable=False)
    source_checksum: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default='new', index=True)
    workflow_id: Mapped[int | None] = mapped_column(ForeignKey('workflows.id', ondelete='SET NULL'), nullable=True)
    latest_run_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    results_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    score_total: Mapped[float | None] = mapped_column(nullable=True, index=True)
    score_maximum: Mapped[float | None] = mapped_column(nullable=True)
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow_naive)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow_naive, onupdate=utcnow_naive)
