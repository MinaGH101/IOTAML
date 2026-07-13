from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.domains.artifacts.repository import artifact_repository
from app.domains.artifacts.schemas import ArtifactDownloadOut, ArtifactOut, ArtifactUsageOut
from app.domains.artifacts.service import artifact_download_url, create_artifact_from_upload, delete_artifact, materialize_artifact, owned_artifact, usage_payload
from app.services.users import get_current_user

router = APIRouter(prefix="/artifacts", tags=["artifacts"])


@router.post("/upload", response_model=ArtifactOut)
def upload_artifact(
    artifact_type: str = Query(default="artifact"),
    project_id: int | None = Query(default=None),
    run_id: int | None = Query(default=None),
    node_id: str | None = Query(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return create_artifact_from_upload(
        db,
        upload=file,
        owner_username=str(current_user["username"]),
        artifact_type=artifact_type,
        project_id=project_id,
        run_id=run_id,
        node_id=node_id,
    )


@router.get("", response_model=list[ArtifactOut])
def list_artifacts(
    project_id: int | None = None,
    run_id: int | None = None,
    node_id: str | None = None,
    artifact_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return artifact_repository.list_for_owner(
        db,
        owner_username=str(current_user["username"]),
        project_id=project_id,
        run_id=run_id,
        node_id=node_id,
        artifact_type=artifact_type,
    )


@router.get("/usage", response_model=ArtifactUsageOut)
def artifact_usage(
    project_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return usage_payload(db, owner_username=str(current_user["username"]), project_id=project_id)


@router.get("/{artifact_id}", response_model=ArtifactOut)
def get_artifact(artifact_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return owned_artifact(db, artifact_id, str(current_user["username"]))


@router.get("/{artifact_id}/download-url", response_model=ArtifactDownloadOut)
def get_download_url(artifact_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return {
        "artifact_id": artifact_id,
        "url": artifact_download_url(db, artifact_id, str(current_user["username"])),
        "expires_in_seconds": get_settings().artifact_signed_url_ttl_seconds,
    }


@router.get("/{artifact_id}/download", include_in_schema=True)
def download_artifact(artifact_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    artifact = owned_artifact(db, artifact_id, str(current_user["username"]))
    if artifact.storage_backend == "minio":
        return RedirectResponse(artifact_download_url(db, artifact_id, str(current_user["username"])))
    path = materialize_artifact(db, artifact.id, cache_group="downloads")
    return FileResponse(path, filename=artifact.original_filename, media_type=artifact.content_type)


@router.delete("/{artifact_id}")
def remove_artifact(artifact_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    delete_artifact(db, artifact_id, str(current_user["username"]))
    db.commit()
    return {"ok": True}
