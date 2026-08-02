"""Authentication-owned persistence models."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.time import utcnow_naive

ROLE_ADMIN = "admin"
ROLE_MANAGER = "manager"
ROLE_EXPERT = "expert"
ROLE_GUEST = "guest"
USER_ROLES = {ROLE_ADMIN, ROLE_MANAGER, ROLE_EXPERT, ROLE_GUEST}


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_active_username", "is_active", "username"),
        Index("ix_users_role_active", "role", "is_active"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    first_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    last_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    phone_number: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(320), nullable=False, default="", index=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default=ROLE_EXPERT, index=True)
    # Kept for backwards-compatible database reads during rollout. New code uses role.
    access_level: Mapped[str] = mapped_column(String(64), nullable=False, default="Expert")
    profile_image: Mapped[str] = mapped_column(String(1024), nullable=False, default="")
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    department: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    activity: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    alarms: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    notifications: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    auth_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow_naive)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow_naive, onupdate=utcnow_naive)
