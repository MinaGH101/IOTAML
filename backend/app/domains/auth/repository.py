"""Authentication persistence queries."""
from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.domains.auth.models import User


class UserRepository:
    def get_by_username(self, db: Session, username: str) -> User | None:
        normalized = username.strip().lower()
        if not normalized:
            return None
        return db.scalar(select(User).where(or_(func.lower(User.username) == normalized, func.lower(User.email) == normalized)).order_by(User.id).limit(1))

    def get(self, db: Session, user_id: int) -> User | None:
        return db.get(User, user_id)

    def list(self, db: Session, *, query: str = '', role: str | None = None, active: bool | None = None, limit: int = 100, offset: int = 0) -> list[User]:
        statement = select(User)
        normalized = query.strip().lower()
        if normalized:
            pattern = f"%{normalized}%"
            statement = statement.where(or_(
                func.lower(User.username).like(pattern),
                func.lower(User.email).like(pattern),
                func.lower(User.first_name).like(pattern),
                func.lower(User.last_name).like(pattern),
            ))
        if role:
            statement = statement.where(User.role == role)
        if active is not None:
            statement = statement.where(User.is_active == active)
        return list(db.scalars(statement.order_by(User.created_at.desc(), User.id.desc()).offset(max(0, offset)).limit(limit)).all())

    def count(self, db: Session) -> int:
        return int(db.scalar(select(func.count(User.id))) or 0)

    def add(self, db: Session, user: User) -> User:
        db.add(user)
        db.flush()
        return user


user_repository = UserRepository()
