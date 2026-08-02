"""Canonical SQLAlchemy base, engine, sessions, and transaction helpers."""
from __future__ import annotations

from collections.abc import Generator, Iterator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import Settings, get_settings


class Base(DeclarativeBase):
    """Single declarative metadata tree used by the application and Alembic."""


def create_database_engine(settings: Settings | None = None, **overrides: Any) -> Engine:
    config = settings or get_settings()
    url = str(overrides.pop('url', config.database_url))
    kwargs: dict[str, Any] = {'pool_pre_ping': True}
    if not url.startswith('sqlite'):
        kwargs.update(
            pool_size=config.database_pool_size,
            max_overflow=config.database_max_overflow,
            pool_timeout=config.database_pool_timeout_seconds,
            pool_recycle=config.database_pool_recycle_seconds,
        )
    kwargs.update(overrides)
    return create_engine(url, **kwargs)


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=Session)


engine = create_database_engine()
SessionLocal = create_session_factory(engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def transactional_session(factory: sessionmaker[Session] | None = None) -> Iterator[Session]:
    session = (factory or SessionLocal)()
    try:
        with session.begin():
            yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
