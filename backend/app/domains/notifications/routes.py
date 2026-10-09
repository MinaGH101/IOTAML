from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.time import utcnow_naive
from app.domains.auth.models import User
from app.domains.auth.service import get_current_user_model
from .models import Notification

router = APIRouter(prefix='/notifications', tags=['notifications'])


def _serialize(item: Notification) -> dict:
    return {
        'id': item.id, 'kind': item.kind, 'title': item.title, 'message': item.message,
        'path': item.path, 'entity_type': item.entity_type, 'entity_id': item.entity_id,
        'data': item.data_json or {}, 'created_at': item.created_at, 'read_at': item.read_at,
    }


@router.get('')
def list_notifications(unread_only: bool = False, limit: int = Query(default=50, ge=1, le=100),
                       db: Session = Depends(get_db), user: User = Depends(get_current_user_model)):
    query = select(Notification).where(Notification.recipient_user_id == user.id)
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    items = db.scalars(query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit)).all()
    return [_serialize(item) for item in items]


@router.post('/{notification_id}/read')
def mark_notification_read(notification_id: int, db: Session = Depends(get_db),
                           user: User = Depends(get_current_user_model)):
    item = db.get(Notification, notification_id)
    if not item or item.recipient_user_id != user.id:
        raise HTTPException(status_code=404, detail='Notification not found.')
    if item.read_at is None:
        item.read_at = utcnow_naive()
        db.commit()
        db.refresh(item)
    return _serialize(item)


@router.post('/read-all')
def mark_all_notifications_read(db: Session = Depends(get_db), user: User = Depends(get_current_user_model)):
    items = db.scalars(select(Notification).where(
        Notification.recipient_user_id == user.id, Notification.read_at.is_(None),
    )).all()
    now = utcnow_naive()
    for item in items:
        item.read_at = now
    db.commit()
    return {'updated': len(items)}
