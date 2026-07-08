from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from pathlib import Path
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

security = HTTPBearer(auto_error=False)

DEFAULT_USER: dict[str, Any] = {
    "username": "admin",
    "password": "admin123",
    "first_name": "IOTA",
    "last_name": "Admin",
    "phone_number": "+994 00 000 00 00",
    "email": "admin@iota.local",
    "access_level": "Admin",
    "profile_image": "",
    "title": "Project Manager",
    "department": "AI Analytics",
    "activity": [
        {"label": "Sat", "value": 4},
        {"label": "Sun", "value": 7},
        {"label": "Mon", "value": 5},
        {"label": "Tue", "value": 9},
        {"label": "Wed", "value": 6},
        {"label": "Thu", "value": 8},
        {"label": "Fri", "value": 3},
    ],
    "alarms": [
        {"title": "Due date check", "message": "Review open projects with due dates this week.", "level": "warning"},
        {"title": "Dataset quality", "message": "Check missing values before training models.", "level": "info"},
    ],
    "notifications": [
        {"title": "Welcome", "message": "Project workspace is ready.", "time": "Today"},
        {"title": "Workflow tip", "message": "Use project detail to keep data and workflows separated.", "time": "Today"},
    ],
}


def user_file_path() -> Path:
    return Path(get_settings().user_file)


def ensure_user_file() -> None:
    path = user_file_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(json.dumps({"users": [DEFAULT_USER]}, ensure_ascii=False, indent=2), encoding="utf-8")


def load_users() -> list[dict[str, Any]]:
    ensure_user_file()
    raw = json.loads(user_file_path().read_text(encoding="utf-8") or "{}")
    if isinstance(raw, list):
        return raw
    users = raw.get("users", [])
    return users if isinstance(users, list) else []


def save_users(users: list[dict[str, Any]]) -> None:
    ensure_user_file()
    user_file_path().write_text(json.dumps({"users": users}, ensure_ascii=False, indent=2), encoding="utf-8")


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in user.items() if key != "password"}


def find_user(username: str) -> dict[str, Any] | None:
    normalized = username.strip().lower()
    for user in load_users():
        if str(user.get("username", "")).strip().lower() == normalized:
            return user
    return None


def authenticate(username: str, password: str) -> dict[str, Any] | None:
    user = find_user(username)
    if not user:
        return None
    stored = str(user.get("password", ""))
    return user if hmac.compare_digest(stored, password) else None


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def issue_token(username: str) -> str:
    settings = get_settings()
    payload = {"sub": username, "exp": int(time.time()) + settings.auth_token_ttl_seconds}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(settings.auth_secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).digest()
    return f"{body}.{_b64(signature)}"


def verify_token(token: str) -> dict[str, Any] | None:
    try:
        body, signature = token.split(".", 1)
        expected = hmac.new(get_settings().auth_secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64(expected), signature):
            return None
        payload = json.loads(_unb64(body).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        username = str(payload.get("sub", ""))
        return find_user(username)
    except Exception:
        return None


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> dict[str, Any]:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required.")
    user = verify_token(credentials.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired login.")
    return user


def update_user_profile(username: str, payload: dict[str, Any]) -> dict[str, Any]:
    users = load_users()
    for user in users:
        if str(user.get("username", "")).strip().lower() == username.strip().lower():
            for key, value in payload.items():
                if key in {"first_name", "last_name", "phone_number", "email", "profile_image", "title", "department"}:
                    user[key] = value
            save_users(users)
            return user
    raise HTTPException(status_code=404, detail="User not found.")
