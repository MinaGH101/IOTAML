from __future__ import annotations

import hashlib
import mimetypes
import os
import tempfile
from datetime import timedelta
from pathlib import Path
from typing import Any, BinaryIO
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.errors import ConflictError, NotFoundError, PermissionDeniedError, QuotaExceededError, StorageUnavailableError, ValidationAppError
from app.domains.artifacts.models import Artifact
from app.domains.artifacts.repository import artifact_repository
from app.infrastructure.storage import get_storage_backend
from app.models import Dataset, Run
from app.services.run_state import utcnow


ARTIFACT_TYPES = {
    "artifact",
    "dataset",
    "model",
    "plot",
    "report",
    "node_output",
    "temporary",
    "log",
    "profile_image",
}


def _validate_artifact_type(artifact_type: str) -> str:
    normalized = artifact_type.strip().lower()
    if normalized not in ARTIFACT_TYPES:
        raise ValidationAppError(
            "INVALID_ARTIFACT_TYPE",
            "Artifact type is not supported.",
            {"artifact_type": artifact_type, "allowed": sorted(ARTIFACT_TYPES)},
        )
    return normalized


def _safe_filename(filename: str) -> str:
    name = Path(filename or "artifact.bin").name.replace("\x00", "")
    return name[:240] or "artifact.bin"


def _object_key(*, project_id: int | None, run_id: int | None, node_id: str | None, artifact_type: str, filename: str) -> str:
    project_part = f"projects/{project_id}" if project_id is not None else "unassigned"
    run_part = f"runs/{run_id}" if run_id is not None else "library"
    node_part = f"nodes/{node_id}" if node_id else artifact_type
    return f"{project_part}/{run_part}/{node_part}/{uuid4().hex}_{_safe_filename(filename)}"


def _copy_and_hash(source: BinaryIO, target: Path, max_bytes: int) -> tuple[int, str]:
    digest = hashlib.sha256()
    total = 0
    with target.open("wb") as output:
        while True:
            chunk = source.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise ValidationAppError(
                    "ARTIFACT_TOO_LARGE",
                    f"Artifact exceeds the {max_bytes}-byte upload limit.",
                    {"max_bytes": max_bytes},
                    status_code=413,
                )
            digest.update(chunk)
            output.write(chunk)
    return total, digest.hexdigest()


def _enforce_quota(db: Session, *, owner_username: str, project_id: int | None, incoming_bytes: int) -> None:
    settings = get_settings()
    owner_total, _, _ = artifact_repository.usage(db, owner_username=owner_username)
    if owner_total + incoming_bytes > settings.artifact_user_quota_bytes:
        raise QuotaExceededError(
            "User storage quota exceeded.",
            {"used_bytes": owner_total, "incoming_bytes": incoming_bytes, "quota_bytes": settings.artifact_user_quota_bytes},
        )
    if project_id is not None:
        project_total, _, _ = artifact_repository.usage(db, owner_username=owner_username, project_id=project_id)
        if project_total + incoming_bytes > settings.artifact_project_quota_bytes:
            raise QuotaExceededError(
                "Project storage quota exceeded.",
                {"used_bytes": project_total, "incoming_bytes": incoming_bytes, "quota_bytes": settings.artifact_project_quota_bytes},
            )


def create_artifact_from_upload(
    db: Session,
    *,
    upload: UploadFile,
    owner_username: str,
    artifact_type: str,
    project_id: int | None = None,
    workflow_id: int | None = None,
    run_id: int | None = None,
    node_id: str | None = None,
    expires_in_days: int | None = None,
    allowed_extensions: set[str] | None = None,
    allowed_content_types: set[str] | None = None,
) -> Artifact:
    settings = get_settings()
    artifact_type = _validate_artifact_type(artifact_type)
    filename = _safe_filename(upload.filename or "artifact.bin")
    extension = Path(filename).suffix.lower()
    content_type = upload.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    if allowed_extensions is not None and extension not in allowed_extensions:
        raise ValidationAppError("UNSUPPORTED_FILE_TYPE", "The uploaded file type is not supported.", {"extension": extension})
    if allowed_content_types is not None and content_type not in allowed_content_types:
        raise ValidationAppError("UNSUPPORTED_CONTENT_TYPE", "The uploaded content type is not supported.", {"content_type": content_type})

    with tempfile.TemporaryDirectory(prefix="iota-upload-") as temp_dir:
        temp_path = Path(temp_dir) / filename
        try:
            upload.file.seek(0)
        except (AttributeError, OSError):
            pass
        size_bytes, checksum = _copy_and_hash(upload.file, temp_path, settings.artifact_max_upload_bytes)
        _enforce_quota(db, owner_username=owner_username, project_id=project_id, incoming_bytes=size_bytes)
        object_key = _object_key(project_id=project_id, run_id=run_id, node_id=node_id, artifact_type=artifact_type, filename=filename)
        backend = get_storage_backend()
        try:
            backend.upload_file(temp_path, object_key, content_type)
        except Exception as exc:
            raise StorageUnavailableError(details={"backend": backend.name}) from exc

    expires_at = utcnow() + timedelta(days=expires_in_days) if expires_in_days else None
    previous = artifact_repository.latest_version(
        db, owner_username=owner_username, project_id=project_id, artifact_type=artifact_type, logical_name=filename
    )
    artifact = Artifact(
        project_id=project_id,
        workflow_id=workflow_id,
        run_id=run_id,
        node_id=node_id,
        owner_username=owner_username,
        artifact_type=artifact_type,
        storage_backend=backend.name,
        bucket=settings.artifact_bucket if backend.name == "minio" else None,
        object_key=object_key,
        original_filename=filename,
        logical_name=filename,
        version=(previous.version + 1) if previous else 1,
        parent_artifact_id=previous.id if previous else None,
        content_type=content_type,
        size_bytes=size_bytes,
        checksum_sha256=checksum,
        status="available",
        expires_at=expires_at,
    )
    artifact_repository.add(db, artifact)
    db.commit()
    db.refresh(artifact)
    return artifact


def create_artifact_from_path(
    db: Session,
    *,
    source_path: Path,
    owner_username: str,
    artifact_type: str,
    project_id: int | None = None,
    workflow_id: int | None = None,
    run_id: int | None = None,
    node_id: str | None = None,
    expires_in_days: int | None = None,
) -> Artifact:
    artifact_type = _validate_artifact_type(artifact_type)
    if not source_path.is_file():
        raise ValidationAppError("ARTIFACT_SOURCE_MISSING", "Artifact source file does not exist.")
    content_type = mimetypes.guess_type(source_path.name)[0] or "application/octet-stream"
    size_bytes = source_path.stat().st_size
    _enforce_quota(db, owner_username=owner_username, project_id=project_id, incoming_bytes=size_bytes)
    digest = hashlib.sha256()
    with source_path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    checksum = digest.hexdigest()
    object_key = _object_key(project_id=project_id, run_id=run_id, node_id=node_id, artifact_type=artifact_type, filename=source_path.name)
    backend = get_storage_backend()
    try:
        backend.upload_file(source_path, object_key, content_type)
    except Exception as exc:
        raise StorageUnavailableError(details={"backend": backend.name}) from exc
    expires_at = utcnow() + timedelta(days=expires_in_days) if expires_in_days else None
    previous = artifact_repository.latest_version(
        db, owner_username=owner_username, project_id=project_id, artifact_type=artifact_type, logical_name=source_path.name
    )
    artifact = Artifact(
        project_id=project_id,
        workflow_id=workflow_id,
        run_id=run_id,
        node_id=node_id,
        owner_username=owner_username,
        artifact_type=artifact_type,
        storage_backend=backend.name,
        bucket=get_settings().artifact_bucket if backend.name == "minio" else None,
        object_key=object_key,
        original_filename=source_path.name,
        logical_name=source_path.name,
        version=(previous.version + 1) if previous else 1,
        parent_artifact_id=previous.id if previous else None,
        content_type=content_type,
        size_bytes=size_bytes,
        checksum_sha256=checksum,
        status="available",
        expires_at=expires_at,
    )
    artifact_repository.add(db, artifact)
    db.flush()
    return artifact


def owned_artifact(db: Session, artifact_id: int, owner_username: str) -> Artifact:
    artifact = artifact_repository.get(db, artifact_id)
    if not artifact or artifact.deleted_at is not None or artifact.status != "available":
        raise NotFoundError("ARTIFACT_NOT_FOUND", "Artifact not found.", {"artifact_id": artifact_id})
    if artifact.owner_username != owner_username:
        raise PermissionDeniedError()
    return artifact


def materialize_artifact(db: Session, artifact_id: int, *, cache_group: str = "artifacts") -> Path:
    artifact = artifact_repository.get(db, artifact_id)
    if not artifact or artifact.deleted_at is not None or artifact.status != "available":
        raise NotFoundError("ARTIFACT_NOT_FOUND", "Artifact not found.", {"artifact_id": artifact_id})
    target = Path(get_settings().storage_dir) / "cache" / cache_group / str(artifact.id) / artifact.original_filename
    if target.exists() and target.stat().st_size == artifact.size_bytes:
        return target
    try:
        return get_storage_backend().download_file(artifact.object_key, target)
    except Exception as exc:
        raise StorageUnavailableError(details={"artifact_id": artifact.id}) from exc


def artifact_download_url(db: Session, artifact_id: int, owner_username: str) -> str:
    artifact = owned_artifact(db, artifact_id, owner_username)
    backend = get_storage_backend()
    if backend.name == "local":
        return f"/api/artifacts/{artifact.id}/download"
    try:
        return backend.presigned_get(
            artifact.object_key,
            timedelta(seconds=get_settings().artifact_signed_url_ttl_seconds),
        )
    except Exception as exc:
        raise StorageUnavailableError(details={"artifact_id": artifact.id}) from exc


def delete_artifact(db: Session, artifact_id: int, owner_username: str, *, force: bool = False) -> Artifact:
    artifact = owned_artifact(db, artifact_id, owner_username)
    if not force:
        if db.query(Dataset).filter(Dataset.artifact_id == artifact.id).first():
            raise ConflictError("ARTIFACT_IN_USE", "Artifact is referenced by a dataset.")
        if artifact.run_id is not None:
            run = db.get(Run, artifact.run_id)
            if run and run.status in {"queued", "running"}:
                raise ConflictError("ARTIFACT_IN_USE", "Artifact belongs to an active run.")
    try:
        get_storage_backend().delete(artifact.object_key)
    except Exception as exc:
        raise StorageUnavailableError(details={"artifact_id": artifact.id}) from exc
    artifact.status = "deleted"
    artifact.deleted_at = utcnow()
    db.flush()
    return artifact


def usage_payload(db: Session, *, owner_username: str, project_id: int | None = None) -> dict[str, Any]:
    total, count, by_type = artifact_repository.usage(db, owner_username=owner_username, project_id=project_id)
    quota = get_settings().artifact_project_quota_bytes if project_id is not None else get_settings().artifact_user_quota_bytes
    return {
        "project_id": project_id,
        "total_bytes": total,
        "quota_bytes": quota,
        "artifact_count": count,
        "by_type": by_type,
    }


def cleanup_expired_artifacts(db: Session, limit: int = 200) -> int:
    removed = 0
    for artifact in artifact_repository.expired(db, utcnow(), limit=limit):
        try:
            get_storage_backend().delete(artifact.object_key)
        except Exception:
            continue
        artifact.status = "expired"
        artifact.deleted_at = utcnow()
        removed += 1
    db.flush()
    return removed


def ingest_run_artifact_paths(db: Session, run: Run, payload: Any) -> Any:
    run_root = (Path(get_settings().storage_dir) / "runs" / str(run.id)).resolve()

    def convert(value: Any, node_id: str | None = None) -> Any:
        if isinstance(value, dict):
            next_node = str(value.get("node_id") or node_id or "") or None
            return {key: convert(item, next_node) for key, item in value.items()}
        if isinstance(value, list):
            return [convert(item, node_id) for item in value]
        if isinstance(value, str):
            candidate = Path(value)
            try:
                resolved = candidate.resolve()
                is_allowed = candidate.is_file() and (resolved == run_root or run_root in resolved.parents)
            except (OSError, RuntimeError):
                is_allowed = False
            if is_allowed:
                artifact = create_artifact_from_path(
                    db,
                    source_path=candidate,
                    owner_username=run.owner_username,
                    artifact_type="node_output",
                    project_id=run.project_id,
                    run_id=run.id,
                    node_id=node_id,
                    expires_in_days=get_settings().artifact_default_retention_days,
                )
                return {
                    "artifact_id": artifact.id,
                    "filename": artifact.original_filename,
                    "content_type": artifact.content_type,
                    "size_bytes": artifact.size_bytes,
                }
        return value

    return convert(payload)
