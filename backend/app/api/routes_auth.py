from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.config import get_settings
from app.schemas import LoginIn, LoginOut, UserProfile, UserProfileUpdate
from app.services.users import authenticate, get_current_user, issue_token, public_user, update_user_profile

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn) -> LoginOut:
    user = authenticate(payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    return LoginOut(access_token=issue_token(str(user["username"])), user=UserProfile(**public_user(user)))


@router.get("/me", response_model=UserProfile)
def me(current_user: dict = Depends(get_current_user)) -> UserProfile:
    return UserProfile(**public_user(current_user))




@router.post("/profile-image", response_model=UserProfile)
async def upload_profile_image(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)) -> UserProfile:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")
    suffix = Path(file.filename or "profile.png").suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        suffix = ".png"
    target_dir = Path(get_settings().storage_dir, "profile-images")
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{current_user.get('username', 'user')}_{uuid4().hex}{suffix}".replace("/", "_").replace("\\", "_")
    path = target_dir / filename
    with path.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            out.write(chunk)
    updated = update_user_profile(str(current_user["username"]), {"profile_image": f"/media/profile-images/{filename}"})
    return UserProfile(**public_user(updated))

@router.put("/profile", response_model=UserProfile)
def update_profile(payload: UserProfileUpdate, current_user: dict = Depends(get_current_user)) -> UserProfile:
    updated = update_user_profile(str(current_user["username"]), payload.model_dump())
    return UserProfile(**public_user(updated))
