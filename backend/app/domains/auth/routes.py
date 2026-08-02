"""Authentication and profile HTTP routes."""
from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.domains.auth.models import User
from app.domains.auth.schemas import ChangePasswordIn, LoginIn, LoginOut, UserProfile, UserProfileUpdate
from app.domains.auth.service import (
    authenticate, change_password, get_current_user_model, issue_token, logout_user,
    public_user, update_user_profile,
)

router = APIRouter(prefix='/auth', tags=['auth'])

_IMAGE_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    '.png': (b'\x89PNG\r\n\x1a\n',), '.jpg': (b'\xff\xd8\xff',), '.jpeg': (b'\xff\xd8\xff',),
    '.gif': (b'GIF87a', b'GIF89a'), '.webp': (b'RIFF',),
}


def _valid_image_signature(suffix: str, header: bytes) -> bool:
    signatures = _IMAGE_SIGNATURES.get(suffix, ())
    if suffix == '.webp':
        return header.startswith(b'RIFF') and len(header) >= 12 and header[8:12] == b'WEBP'
    return any(header.startswith(signature) for signature in signatures)


@router.post('/login', response_model=LoginOut, dependencies=[Depends(rate_limit('login', limit=get_settings().login_rate_limit_per_minute))])
def login(payload: LoginIn, db: Session = Depends(get_db)) -> LoginOut:
    user = authenticate(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail='Invalid username or password.')
    return LoginOut(access_token=issue_token(user), user=UserProfile(**public_user(user)))


@router.post('/logout')
def logout(db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    logout_user(db, current_user)
    return {'ok': True}


@router.get('/me', response_model=UserProfile)
def me(current_user: User = Depends(get_current_user_model)) -> UserProfile:
    return UserProfile(**public_user(current_user))


@router.post('/change-password')
def change_password_route(payload: ChangePasswordIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    change_password(db, current_user, payload.current_password, payload.new_password)
    return {'ok': True}


@router.post('/profile-image', response_model=UserProfile)
async def upload_profile_image(
    file: UploadFile = File(...), current_user: User = Depends(get_current_user_model), db: Session = Depends(get_db),
    _: None = Depends(rate_limit('profile_image_upload', limit=get_settings().upload_rate_limit_per_minute)),
) -> UserProfile:
    suffix = Path(file.filename or '').suffix.lower()
    if suffix not in _IMAGE_SIGNATURES:
        raise HTTPException(status_code=400, detail='Supported profile images are PNG, JPEG, GIF, and WebP.')
    settings = get_settings()
    target_dir = Path(settings.storage_dir, 'profile-images').resolve(); target_dir.mkdir(parents=True, exist_ok=True)
    path = (target_dir / f'profile_{uuid4().hex}{suffix}').resolve()
    if target_dir not in path.parents:
        raise HTTPException(status_code=400, detail='Invalid upload path.')
    written = 0; header = b''
    try:
        with path.open('xb') as out:
            while chunk := await file.read(1024 * 1024):
                if not header: header = chunk[:32]
                written += len(chunk)
                if written > settings.profile_image_max_bytes:
                    raise HTTPException(status_code=413, detail='Profile image exceeds the configured size limit.')
                out.write(chunk)
        if not header or not _valid_image_signature(suffix, header):
            raise HTTPException(status_code=400, detail='The uploaded file content does not match its image extension.')
    except Exception:
        path.unlink(missing_ok=True); raise
    finally:
        await file.close()
    updated = update_user_profile(db, current_user.username, {'profile_image': f'/media/profile-images/{path.name}'})
    return UserProfile(**public_user(updated))


@router.put('/profile', response_model=UserProfile)
def update_profile(payload: UserProfileUpdate, current_user: User = Depends(get_current_user_model), db: Session = Depends(get_db)) -> UserProfile:
    updated = update_user_profile(db, current_user.username, payload.model_dump())
    return UserProfile(**public_user(updated))
