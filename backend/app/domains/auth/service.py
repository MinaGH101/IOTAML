"""Database-backed authentication and stable environment-admin bootstrap."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.domains.auth.models import ROLE_ADMIN, ROLE_EXPERT, USER_ROLES, User
from app.domains.auth.repository import user_repository

security = HTTPBearer(auto_error=False)
ROLE_LABELS = {'admin': 'Admin', 'manager': 'Manager', 'expert': 'Expert', 'guest': 'Guest'}
LEGACY_ROLE_MAP = {
    'admin': 'admin', 'administrator': 'admin',
    'manager': 'manager', 'project manager': 'manager',
    'expert': 'expert', 'editor': 'expert', 'user': 'expert',
    'guest': 'guest', 'viewer': 'guest', 'view': 'guest',
}


def normalize_role(value: str | None) -> str:
    normalized = str(value or '').strip().lower()
    return LEGACY_ROLE_MAP.get(normalized, normalized if normalized in USER_ROLES else ROLE_EXPERT)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + '=' * (-len(data) % 4))


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 310_000)
    return f"pbkdf2_sha256$310000${_b64(salt)}${_b64(digest)}"


def verify_password(stored: str, password: str) -> bool:
    if stored.startswith('pbkdf2_sha256$'):
        try:
            _, rounds, salt, expected = stored.split('$', 3)
            digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), _unb64(salt), int(rounds))
            return hmac.compare_digest(_b64(digest), expected)
        except (TypeError, ValueError):
            return False
    return hmac.compare_digest(stored, password)


# Backwards-compatible names retained for existing callers and tests.
_password_hash = hash_password
_verify_password = verify_password

def bootstrap_users(db: Session) -> int:
    """Ensure the configured admin exists without resetting an existing password.

    The password is read only when the admin row must be created. Database resets
    therefore recreate the same login, while normal migrations/restarts never
    overwrite a password changed through the application.
    """
    settings = get_settings()
    if not settings.admin_bootstrap_enabled:
        return 0
    email = settings.admin_email.strip().lower()
    password = settings.admin_password
    if not email or not password:
        if settings.app_environment == 'production':
            raise RuntimeError('ADMIN_EMAIL and ADMIN_PASSWORD are required in production.')
        return 0
    user = db.scalar(select(User).where(or_(func.lower(User.username) == email, func.lower(User.email) == email)))
    if user:
        changed = False
        if user.role != ROLE_ADMIN:
            user.role = ROLE_ADMIN
            user.access_level = ROLE_LABELS[ROLE_ADMIN]
            changed = True
        if not user.is_active:
            user.is_active = True
            changed = True
        if not user.email:
            user.email = email
            changed = True
        if changed:
            db.commit()
        return 0
    db.add(User(
        username=email,
        email=email,
        password_hash=hash_password(password),
        first_name=settings.admin_first_name.strip(),
        last_name=settings.admin_last_name.strip(),
        role=ROLE_ADMIN,
        access_level=ROLE_LABELS[ROLE_ADMIN],
        is_active=True,
    ))
    db.commit()
    return 1


def user_to_dict(user: User) -> dict[str, Any]:
    role = normalize_role(user.role or user.access_level)
    return {
        'id': user.id,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'phone_number': user.phone_number,
        'email': user.email,
        'role': role,
        'access_level': ROLE_LABELS[role],
        'profile_image': user.profile_image,
        'title': user.title,
        'department': user.department,
        'activity': list(user.activity or []),
        'alarms': list(user.alarms or []),
        'notifications': list(user.notifications or []),
        'is_active': user.is_active,
    }


def public_user(user: User | dict[str, Any]) -> dict[str, Any]:
    return user_to_dict(user) if isinstance(user, User) else {key: value for key, value in user.items() if key not in {'password', 'password_hash', 'auth_version'}}


def authenticate(db: Session, username: str, password: str) -> User | None:
    user = user_repository.get_by_username(db, username)
    if not user or not user.is_active or not verify_password(user.password_hash, password):
        return None
    if not user.password_hash.startswith('pbkdf2_sha256$'):
        user.password_hash = hash_password(password)
        db.commit()
    return user


def issue_token(user: User) -> str:
    settings = get_settings()
    payload = {'sub': user.username, 'uid': user.id, 'ver': user.auth_version, 'exp': int(time.time()) + settings.auth_token_ttl_seconds}
    body = _b64(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    signature = hmac.new(settings.auth_secret.encode('utf-8'), body.encode('utf-8'), hashlib.sha256).digest()
    return f'{body}.{_b64(signature)}'


def token_payload(token: str) -> dict[str, Any] | None:
    try:
        body, signature = token.split('.', 1)
        expected = hmac.new(get_settings().auth_secret.encode('utf-8'), body.encode('utf-8'), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64(expected), signature):
            return None
        payload = json.loads(_unb64(body).decode('utf-8'))
        if int(payload.get('exp', 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def get_current_user_model(credentials: HTTPAuthorizationCredentials | None = Depends(security), db: Session = Depends(get_db)) -> User:
    if not credentials or credentials.scheme.lower() != 'bearer':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Login required.')
    payload = token_payload(credentials.credentials)
    user = db.get(User, int(payload.get('uid'))) if payload and payload.get('uid') else None
    if not user and payload:
        user = user_repository.get_by_username(db, str(payload.get('sub') or ''))
    if not user or not user.is_active or int(payload.get('ver', -1)) != user.auth_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or expired login.')
    return user


def get_current_user(user: User = Depends(get_current_user_model)) -> dict[str, Any]:
    return user_to_dict(user)


def require_role(*roles: str):
    allowed = {normalize_role(role) for role in roles}
    def dependency(user: User = Depends(get_current_user_model)) -> User:
        if normalize_role(user.role) not in allowed:
            raise HTTPException(status_code=403, detail='You do not have permission to perform this action.')
        return user
    return dependency


def _ensure_identity_available(db: Session, *, username: str, email: str, exclude_user_id: int | None = None) -> None:
    username_value = username.strip().lower()
    email_value = email.strip().lower()
    conditions = [func.lower(User.username) == username_value]
    if email_value:
        conditions.extend([func.lower(User.email) == email_value, func.lower(User.username) == email_value])
    if username_value:
        conditions.append(func.lower(User.email) == username_value)
    statement = select(User.id).where(or_(*conditions))
    if exclude_user_id is not None:
        statement = statement.where(User.id != exclude_user_id)
    if db.scalar(statement.limit(1)) is not None:
        raise HTTPException(status_code=409, detail='Username or email already exists.')


def update_user_profile(db: Session, username: str, payload: dict[str, Any]) -> User:
    user = user_repository.get_by_username(db, username)
    if not user:
        raise HTTPException(status_code=404, detail='User not found.')
    next_email = str(payload.get('email', user.email) or '').strip().lower()
    _ensure_identity_available(db, username=user.username, email=next_email, exclude_user_id=user.id)
    for key, value in payload.items():
        if key in {'first_name', 'last_name', 'phone_number', 'email', 'profile_image', 'title', 'department'}:
            normalized = str(value or '').strip().lower() if key == 'email' else str(value or '').strip()
            setattr(user, key, normalized)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(user.password_hash, current_password):
        raise HTTPException(status_code=400, detail='Current password is incorrect.')
    user.password_hash = hash_password(new_password)
    user.auth_version += 1
    db.commit()


def logout_user(db: Session, user: User) -> None:
    user.auth_version += 1
    db.commit()


def create_user(db: Session, payload: dict[str, Any]) -> User:
    role = normalize_role(payload.get('role'))
    username = str(payload['username']).strip().lower()
    email = str(payload.get('email') or '').strip().lower()
    _ensure_identity_available(db, username=username, email=email)
    user = User(
        username=username,
        email=email,
        password_hash=hash_password(str(payload['password'])),
        first_name=str(payload.get('first_name') or '').strip(),
        last_name=str(payload.get('last_name') or '').strip(),
        phone_number=str(payload.get('phone_number') or '').strip(),
        title=str(payload.get('title') or '').strip(),
        department=str(payload.get('department') or '').strip(),
        role=role,
        access_level=ROLE_LABELS[role],
        is_active=bool(payload.get('is_active', True)),
    )
    try:
        user_repository.add(db, user)
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail='Username or email already exists.') from exc
    return user


def update_managed_user(db: Session, user: User, payload: dict[str, Any], acting_user: User) -> User:
    data = {key: value for key, value in payload.items() if value is not None}
    if user.id == acting_user.id and data.get('role') and normalize_role(data['role']) != ROLE_ADMIN:
        raise HTTPException(status_code=400, detail='An admin cannot remove their own admin role.')
    if user.id == acting_user.id and data.get('is_active') is False:
        raise HTTPException(status_code=400, detail='An admin cannot disable their own account.')
    next_username = str(data.get('username', user.username) or '').strip().lower()
    if next_username != user.username.lower():
        raise HTTPException(status_code=400, detail='Usernames are immutable after account creation.')
    next_email = str(data.get('email', user.email) or '').strip().lower()
    _ensure_identity_available(db, username=user.username, email=next_email, exclude_user_id=user.id)
    for field in {'email', 'first_name', 'last_name', 'phone_number', 'title', 'department'}:
        if field in data:
            setattr(user, field, str(data[field] or '').strip().lower() if field == 'email' else str(data[field] or '').strip())
    if 'role' in data:
        user.role = normalize_role(data['role'])
        user.access_level = ROLE_LABELS[user.role]
    if 'is_active' in data:
        user.is_active = bool(data['is_active'])
        user.auth_version += 1
    if data.get('password'):
        user.password_hash = hash_password(str(data['password']))
        user.auth_version += 1
    try:
        db.commit(); db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail='Username or email already exists.') from exc
    return user
