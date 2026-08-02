"""User-defined node persistence model."""
from __future__ import annotations
from datetime import datetime
from sqlalchemy import Boolean, DateTime, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.core.time import utcnow_naive

class CustomNode(Base):
    __tablename__ = 'custom_nodes'
    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    owner_username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default='')
    inputs: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    outputs: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    template: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)
