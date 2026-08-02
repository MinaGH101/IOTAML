"""Artifacts domain service for the IOTA ML backend."""

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
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import ConflictError, NotFoundError, PermissionDeniedError, QuotaExceededError, StorageUnavailableError, ValidationAppError
from app.domains.artifacts.models import Artifact, ArtifactQuotaReservation, NodeCacheEntry
from app.domains.artifacts.repository import artifact_repository
from app.infrastructure.storage import get_storage_backend
from app.domains.datasets.models import Dataset
from app.domains.projects.models import Project
from app.domains.runs.models import Run
from app.infrastructure.queue.state import utcnow


ARTIFACT_TYPES = {
    "artifact",
    "dataset",
    "model",
    "plot",
    "report",
    "node_output",
    "node_cache",
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
    name = Path(filename or 'artifact.bin').name.replace('\x00', '').strip()
    if any(separator in name for separator in ('/', '\\')):
        raise ValidationAppError('INVALID_FILENAME', 'Filename contains a path separator.')
    return name[:240] or 'artifact.bin'


def _object_key(*, project_id: int | None, run_id: int | None, node_id: str | None, artifact_type: str, filename: str) -> str:
    project_part = f'projects/{project_id}' if project_id is not None else 'unassigned'
    run_part = f'runs/{run_id}' if run_id is not None else 'library'
    node_part = f'nodes/{str(node_id)[:80]}' if node_id else artifact_type
    extension = Path(filename).suffix.lower()[:16]
    return f'{project_part}/{run_part}/{node_part}/{uuid4().hex}{extension}'


def _temporary_key(final_key: str) -> str:
    return f'_tmp/{uuid4().hex}/{Path(final_key).name}.upload'


def _copy_and_hash(source: BinaryIO, target: Path, max_bytes: int) -> tuple[int, str]:
    digest = hashlib.sha256()
    total = 0
    with target.open('wb') as output:
        while True:
            chunk = source.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise ValidationAppError(
                    'ARTIFACT_TOO_LARGE',
                    f'Artifact exceeds the {max_bytes}-byte upload limit.',
                    {'max_bytes': max_bytes},
                    status_code=413,
                )
            digest.update(chunk)
            output.write(chunk)
    return total, digest.hexdigest()


def _validate_scope_ownership(
    db: Session,
    *,
    owner_username: str,
    project_id: int | None,
    run_id: int | None,
) -> None:
    if project_id is not None:
        project = db.execute(select(Project.id).where(Project.id == project_id, Project.owner_username == owner_username)).scalar_one_or_none()
        if project is None:
            raise NotFoundError('PROJECT_NOT_FOUND', 'Project not found.', {'project_id': project_id})
    if run_id is not None:
        run = db.execute(select(Run).where(Run.id == run_id, Run.owner_username == owner_username)).scalar_one_or_none()
        if run is None:
            raise NotFoundError('RUN_NOT_FOUND', 'Run not found.', {'run_id': run_id})
        if project_id is not None and run.project_id != project_id:
            raise ValidationAppError('ARTIFACT_SCOPE_MISMATCH', 'Run and artifact project do not match.')


def _reservation_totals(db: Session, owner_username: str, project_id: int | None) -> tuple[int, int]:
    now = utcnow()
    owner_reserved = int(db.execute(
        select(func.coalesce(func.sum(ArtifactQuotaReservation.reserved_bytes), 0)).where(
            ArtifactQuotaReservation.owner_username == owner_username,
            ArtifactQuotaReservation.status == 'active',
            ArtifactQuotaReservation.expires_at > now,
        )
    ).scalar_one() or 0)
    project_reserved = 0
    if project_id is not None:
        project_reserved = int(db.execute(
            select(func.coalesce(func.sum(ArtifactQuotaReservation.reserved_bytes), 0)).where(
                ArtifactQuotaReservation.owner_username == owner_username,
                ArtifactQuotaReservation.project_id == project_id,
                ArtifactQuotaReservation.status == 'active',
                ArtifactQuotaReservation.expires_at > now,
            )
        ).scalar_one() or 0)
    return owner_reserved, project_reserved


def _reserve_quota(
    db: Session,
    *,
    owner_username: str,
    project_id: int | None,
    incoming_bytes: int,
) -> ArtifactQuotaReservation:
    settings = get_settings()
    if db.bind is not None and db.bind.dialect.name == 'postgresql':
        # Transaction-scoped lock makes the usage + reservation check atomic for
        # every upload in the same user/project scope.
        scope = f'artifact-quota:{owner_username}:{project_id if project_id is not None else "all"}'
        db.execute(text('SELECT pg_advisory_xact_lock(hashtext(:scope))'), {'scope': scope})
    owner_total, _, _ = artifact_repository.usage(db, owner_username=owner_username)
    project_total = 0
    if project_id is not None:
        project_total, _, _ = artifact_repository.usage(db, owner_username=owner_username, project_id=project_id)
    owner_reserved, project_reserved = _reservation_totals(db, owner_username, project_id)
    if owner_total + owner_reserved + incoming_bytes > settings.artifact_user_quota_bytes:
        raise QuotaExceededError('User storage quota exceeded.', {
            'used_bytes': owner_total, 'reserved_bytes': owner_reserved,
            'incoming_bytes': incoming_bytes, 'quota_bytes': settings.artifact_user_quota_bytes,
        })
    if project_id is not None and project_total + project_reserved + incoming_bytes > settings.artifact_project_quota_bytes:
        raise QuotaExceededError('Project storage quota exceeded.', {
            'used_bytes': project_total, 'reserved_bytes': project_reserved,
            'incoming_bytes': incoming_bytes, 'quota_bytes': settings.artifact_project_quota_bytes,
        })
    reservation = ArtifactQuotaReservation(
        owner_username=owner_username,
        project_id=project_id,
        reserved_bytes=incoming_bytes,
        status='active',
        expires_at=utcnow() + timedelta(seconds=settings.artifact_pending_timeout_seconds),
    )
    db.add(reservation)
    db.flush()
    return reservation


def _release_reservation(reservation: ArtifactQuotaReservation, status: str = 'released') -> None:
    reservation.status = status
    reservation.released_at = utcnow()


def _new_pending_artifact(
    db: Session,
    *,
    owner_username: str,
    artifact_type: str,
    filename: str,
    content_type: str,
    size_bytes: int,
    checksum: str,
    object_key: str,
    project_id: int | None,
    workflow_id: int | None,
    run_id: int | None,
    node_id: str | None,
    expires_in_days: int | None,
    logical_name: str | None = None,
    cache_key: str | None = None,
    schema_json: dict[str, Any] | None = None,
    metadata_json: dict[str, Any] | None = None,
    pinned: bool = False,
) -> Artifact:
    name = logical_name or filename
    previous = artifact_repository.latest_version(
        db, owner_username=owner_username, project_id=project_id,
        artifact_type=artifact_type, logical_name=name,
    )
    backend = get_storage_backend()
    artifact = Artifact(
        project_id=project_id, workflow_id=workflow_id, run_id=run_id, node_id=node_id,
        owner_username=owner_username, artifact_type=artifact_type,
        storage_backend=backend.name,
        bucket=get_settings().artifact_bucket if backend.name == 'minio' else None,
        object_key=object_key, original_filename=filename, logical_name=name,
        version=(previous.version + 1) if previous else 1,
        parent_artifact_id=previous.id if previous else None,
        content_type=content_type, size_bytes=size_bytes, checksum_sha256=checksum,
        cache_key=cache_key, schema_json=schema_json, metadata_json=metadata_json,
        pinned=pinned, status='pending',
        expires_at=utcnow() + timedelta(days=expires_in_days) if expires_in_days else None,
    )
    artifact_repository.add(db, artifact)
    return artifact


def _publish_file(
    db: Session,
    *,
    artifact: Artifact,
    reservation: ArtifactQuotaReservation,
    source_path: Path,
    final_key: str,
) -> Artifact:
    backend = get_storage_backend()
    temporary_key = artifact.object_key
    artifact.status = 'uploading'
    db.flush()
    try:
        backend.put(source_path, temporary_key, artifact.content_type)
        uploaded = backend.stat(temporary_key)
        if int(uploaded.get('size_bytes') or -1) != artifact.size_bytes:
            raise StorageUnavailableError('Stored object size verification failed.', {'artifact_id': artifact.id})
        backend.move(temporary_key, final_key)
        finalized = backend.stat(final_key)
        if int(finalized.get('size_bytes') or -1) != artifact.size_bytes:
            raise StorageUnavailableError('Final object size verification failed.', {'artifact_id': artifact.id})
        artifact.object_key = final_key
        artifact.status = 'available'
        reservation.artifact_id = artifact.id
        _release_reservation(reservation)
        db.flush()
        return artifact
    except Exception as exc:
        for key in (temporary_key, final_key):
            try:
                backend.delete(key)
            except Exception:
                pass
        artifact.status = 'failed'
        artifact.metadata_json = {
            **(artifact.metadata_json or {}),
            'failure_reason': str(exc)[:1000],
        }
        _release_reservation(reservation, 'failed')
        db.flush()
        if isinstance(exc, (ValidationAppError, StorageUnavailableError)):
            raise
        raise StorageUnavailableError(details={'backend': backend.name, 'artifact_id': artifact.id}) from exc


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
    filename = _safe_filename(upload.filename or 'artifact.bin')
    extension = Path(filename).suffix.lower()
    content_type = upload.content_type or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
    if allowed_extensions is not None and extension not in allowed_extensions:
        raise ValidationAppError('UNSUPPORTED_FILE_TYPE', 'The uploaded file type is not supported.', {'extension': extension})
    if allowed_content_types is not None and content_type not in allowed_content_types:
        raise ValidationAppError('UNSUPPORTED_CONTENT_TYPE', 'The uploaded content type is not supported.', {'content_type': content_type})
    _validate_scope_ownership(db, owner_username=owner_username, project_id=project_id, run_id=run_id)

    with tempfile.TemporaryDirectory(prefix='iota-upload-') as temp_dir:
        temp_path = Path(temp_dir) / 'payload'
        try:
            upload.file.seek(0)
        except (AttributeError, OSError):
            pass
        size_bytes, checksum = _copy_and_hash(upload.file, temp_path, settings.artifact_max_upload_bytes)
        final_key = _object_key(project_id=project_id, run_id=run_id, node_id=node_id, artifact_type=artifact_type, filename=filename)
        reservation = _reserve_quota(db, owner_username=owner_username, project_id=project_id, incoming_bytes=size_bytes)
        artifact = _new_pending_artifact(
            db, owner_username=owner_username, artifact_type=artifact_type,
            filename=filename, content_type=content_type, size_bytes=size_bytes,
            checksum=checksum, object_key=_temporary_key(final_key), project_id=project_id,
            workflow_id=workflow_id, run_id=run_id, node_id=node_id,
            expires_in_days=expires_in_days,
        )
        reservation.artifact_id = artifact.id
        # Make pending state durable before touching non-transactional storage.
        db.commit()
        try:
            artifact = _publish_file(db, artifact=artifact, reservation=reservation, source_path=temp_path, final_key=final_key)
            db.commit()
            db.refresh(artifact)
            return artifact
        except Exception:
            try:
                db.commit()
            except SQLAlchemyError:
                db.rollback()
            raise


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
    logical_name: str | None = None,
    content_type_override: str | None = None,
    cache_key: str | None = None,
    schema_json: dict[str, Any] | None = None,
    metadata_json: dict[str, Any] | None = None,
    pinned: bool = False,
) -> Artifact:
    artifact_type = _validate_artifact_type(artifact_type)
    if not source_path.is_file():
        raise ValidationAppError('ARTIFACT_SOURCE_MISSING', 'Artifact source file does not exist.')
    filename = _safe_filename(source_path.name)
    content_type = content_type_override or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
    size_bytes = source_path.stat().st_size
    if size_bytes > get_settings().artifact_max_upload_bytes:
        raise ValidationAppError('ARTIFACT_TOO_LARGE', 'Artifact exceeds the configured size limit.', status_code=413)
    digest = hashlib.sha256()
    with source_path.open('rb') as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    checksum = digest.hexdigest()
    final_key = _object_key(project_id=project_id, run_id=run_id, node_id=node_id, artifact_type=artifact_type, filename=filename)
    reservation = _reserve_quota(db, owner_username=owner_username, project_id=project_id, incoming_bytes=size_bytes)
    artifact = _new_pending_artifact(
        db, owner_username=owner_username, artifact_type=artifact_type,
        filename=filename, content_type=content_type, size_bytes=size_bytes,
        checksum=checksum, object_key=_temporary_key(final_key), project_id=project_id,
        workflow_id=workflow_id, run_id=run_id, node_id=node_id,
        expires_in_days=expires_in_days, logical_name=logical_name,
        cache_key=cache_key, schema_json=schema_json, metadata_json=metadata_json,
        pinned=pinned,
    )
    reservation.artifact_id = artifact.id
    return _publish_file(db, artifact=artifact, reservation=reservation, source_path=source_path, final_key=final_key)


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
        artifact.last_accessed_at = utcnow()
        db.flush()
        return target
    try:
        downloaded = get_storage_backend().download_file(artifact.object_key, target)
        digest = hashlib.sha256()
        with downloaded.open("rb") as source:
            while chunk := source.read(1024 * 1024):
                digest.update(chunk)
        if digest.hexdigest() != artifact.checksum_sha256:
            downloaded.unlink(missing_ok=True)
            raise StorageUnavailableError("Artifact checksum verification failed.", {"artifact_id": artifact.id})
        artifact.last_accessed_at = utcnow()
        db.flush()
        return downloaded
    except StorageUnavailableError:
        raise
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
    artifact.status = 'delete_pending'
    db.flush()
    try:
        get_storage_backend().delete(artifact.object_key)
    except Exception as exc:
        # Leave delete_pending for the idempotent reconciliation job.
        raise StorageUnavailableError(details={'artifact_id': artifact.id}) from exc
    artifact.status = 'deleted'
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
        artifact.status = 'delete_pending'
        try:
            get_storage_backend().delete(artifact.object_key)
        except Exception:
            continue
        artifact.status = 'deleted'
        artifact.deleted_at = utcnow()
        artifact.metadata_json = {**(artifact.metadata_json or {}), 'deletion_reason': 'expired'}
        removed += 1
    db.flush()
    return removed


def reconcile_artifacts(
    db: Session,
    *,
    dry_run: bool = True,
    limit: int | None = None,
    verify_checksums: bool = False,
) -> dict[str, int]:
    """Repair bounded storage/database drift without loading a bucket in memory."""
    settings = get_settings()
    batch_size = min(limit or settings.artifact_reconciliation_batch_size, 5000)
    backend = get_storage_backend()
    now = utcnow()
    stale_before = now - timedelta(seconds=settings.artifact_pending_timeout_seconds)
    summary = {
        'stale_pending': 0,
        'missing_objects': 0,
        'delete_pending_completed': 0,
        'temporary_orphans': 0,
        'broken_cache_entries': 0,
        'expired_reservations': 0,
        'checksum_failures': 0,
    }

    stale = db.execute(select(Artifact).where(
        Artifact.status.in_({'pending', 'uploading'}),
        Artifact.created_at < stale_before,
    ).order_by(Artifact.created_at).limit(batch_size)).scalars().all()
    for artifact in stale:
        summary['stale_pending'] += 1
        if not dry_run:
            try:
                backend.delete(artifact.object_key)
            except Exception:
                pass
            artifact.status = 'failed'
            artifact.metadata_json = {**(artifact.metadata_json or {}), 'failure_reason': 'stale pending upload'}

    available = db.execute(select(Artifact).where(
        Artifact.status == 'available', Artifact.deleted_at.is_(None)
    ).order_by(Artifact.id).limit(batch_size)).scalars().all()
    for artifact in available:
        if not backend.exists(artifact.object_key):
            summary['missing_objects'] += 1
            if not dry_run:
                artifact.status = 'failed'
                artifact.metadata_json = {**(artifact.metadata_json or {}), 'failure_reason': 'storage object missing'}
            continue
        if verify_checksums:
            digest = hashlib.sha256()
            try:
                with backend.reader(artifact.object_key) as stream:
                    while chunk := stream.read(1024 * 1024):
                        digest.update(chunk)
                mismatch = digest.hexdigest() != artifact.checksum_sha256
            except Exception:
                mismatch = True
            if mismatch:
                summary['checksum_failures'] += 1
                if not dry_run:
                    artifact.status = 'failed'
                    artifact.metadata_json = {**(artifact.metadata_json or {}), 'failure_reason': 'checksum mismatch'}

    pending_deletes = db.execute(select(Artifact).where(
        Artifact.status == 'delete_pending'
    ).order_by(Artifact.id).limit(batch_size)).scalars().all()
    for artifact in pending_deletes:
        try:
            exists = backend.exists(artifact.object_key)
            if exists and not dry_run:
                backend.delete(artifact.object_key)
            if not dry_run:
                artifact.status = 'deleted'
                artifact.deleted_at = artifact.deleted_at or now
            summary['delete_pending_completed'] += 1
        except Exception:
            continue

    expired_reservations = db.execute(select(ArtifactQuotaReservation).where(
        ArtifactQuotaReservation.status == 'active',
        ArtifactQuotaReservation.expires_at <= now,
    ).order_by(ArtifactQuotaReservation.id).limit(batch_size)).scalars().all()
    summary['expired_reservations'] = len(expired_reservations)
    if not dry_run:
        for reservation in expired_reservations:
            _release_reservation(reservation, 'expired')

    broken_cache = db.execute(select(NodeCacheEntry).outerjoin(
        Artifact, Artifact.id == NodeCacheEntry.artifact_id
    ).where(
        NodeCacheEntry.status == 'available',
        ((Artifact.id.is_(None)) | (Artifact.status != 'available') | (Artifact.deleted_at.is_not(None))),
    ).limit(batch_size)).scalars().all()
    summary['broken_cache_entries'] = len(broken_cache)
    if not dry_run:
        for entry in broken_cache:
            entry.status = 'invalid'

    keys = list(backend.iter_keys('_tmp', limit=batch_size))
    if keys:
        referenced = set(db.execute(select(Artifact.object_key).where(Artifact.object_key.in_(keys))).scalars().all())
        for key in keys:
            if key in referenced:
                continue
            summary['temporary_orphans'] += 1
            if not dry_run:
                try:
                    backend.delete(key)
                except Exception:
                    pass

    db.flush()
    return summary


def ingest_run_artifact_paths(db: Session, run: Run, payload: Any) -> Any:
    storage_root = Path(get_settings().storage_dir).resolve()
    canonical_run_root = (storage_root / "runs" / str(run.id)).resolve()
    persisted: dict[Path, dict[str, Any]] = {}

    def path_candidate(value: str) -> Path | None:
        if not value or len(value) > 4096 or "\n" in value or "\x00" in value:
            return None
        if "/" not in value and "\\" not in value:
            return None
        candidate = Path(value)
        if not candidate.suffix:
            return None
        try:
            resolved = candidate.resolve()
            if not resolved.is_file() or storage_root not in resolved.parents:
                return None
            parts = resolved.parts
            belongs_to_run = resolved == canonical_run_root or canonical_run_root in resolved.parents
            if not belongs_to_run:
                belongs_to_run = any(
                    parts[index] == "runs" and index + 1 < len(parts) and parts[index + 1] == str(run.id)
                    for index in range(len(parts) - 1)
                )
            return resolved if belongs_to_run else None
        except (OSError, RuntimeError, ValueError):
            return None

    def convert(value: Any, node_id: str | None = None) -> Any:
        if isinstance(value, dict):
            next_node = str(value.get("node_id") or node_id or "") or None
            return {key: convert(item, next_node) for key, item in value.items()}
        if isinstance(value, list):
            return [convert(item, node_id) for item in value]
        if isinstance(value, str):
            resolved = path_candidate(value)
            if resolved is not None:
                cached = persisted.get(resolved)
                if cached is not None:
                    return cached
                artifact = create_artifact_from_path(
                    db,
                    source_path=resolved,
                    owner_username=run.owner_username,
                    artifact_type="node_output",
                    project_id=run.project_id,
                    run_id=run.id,
                    node_id=node_id,
                    expires_in_days=get_settings().artifact_default_retention_days,
                )
                reference = {
                    "artifact_id": artifact.id,
                    "filename": artifact.original_filename,
                    "content_type": artifact.content_type,
                    "size_bytes": artifact.size_bytes,
                }
                persisted[resolved] = reference
                return reference
        return value

    return convert(payload)

