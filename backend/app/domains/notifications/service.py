from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import Notification


def create_notification(db: Session, *, recipient_user_id: int, kind: str, title: str, message: str,
                        dedupe_key: str, path: str | None = None, entity_type: str | None = None,
                        entity_id: str | None = None, data: dict | None = None) -> Notification:
    existing = db.scalar(select(Notification).where(Notification.dedupe_key == dedupe_key))
    if existing:
        return existing
    notification = Notification(
        recipient_user_id=recipient_user_id, kind=kind, title=title[:160], message=message[:500],
        path=path, entity_type=entity_type, entity_id=entity_id, dedupe_key=dedupe_key[:255],
        data_json=data or {},
    )
    try:
        with db.begin_nested():
            db.add(notification)
            db.flush()
        return notification
    except IntegrityError:
        existing = db.scalar(select(Notification).where(Notification.dedupe_key == dedupe_key))
        if existing:
            return existing
        raise
