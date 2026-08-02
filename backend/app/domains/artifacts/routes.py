"""Artifact routes with project-level authorization."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.domains.artifacts.models import Artifact, ArtifactLineage, NodeCacheEntry
from app.domains.artifacts.repository import artifact_repository
from app.domains.artifacts.schemas import ArtifactDownloadOut, ArtifactOut, ArtifactUsageOut
from app.domains.artifacts.service import artifact_download_url, create_artifact_from_upload, delete_artifact, materialize_artifact, owned_artifact, usage_payload
from app.domains.auth.models import User
from app.domains.auth.service import get_current_user_model
from app.domains.projects.access import require_project_edit, require_project_view
from app.workflow.caching.service import clear_project_cache

router = APIRouter(prefix='/artifacts', tags=['artifacts'])


def _scope_owner(db: Session, project_id: int | None, user: User, *, write: bool = False) -> str:
    if project_id is None:
        return user.username
    project, _ = require_project_edit(db, project_id, user) if write else require_project_view(db, project_id, user)
    return project.owner_username


def _artifact_and_owner(db: Session, artifact_id: int, user: User, *, write: bool = False):
    artifact = artifact_repository.get(db, artifact_id)
    if not artifact or artifact.deleted_at is not None:
        raise HTTPException(status_code=404, detail='Artifact not found.')
    if artifact.project_id is None:
        if artifact.owner_username.lower() != user.username.lower():
            raise HTTPException(status_code=404, detail='Artifact not found.')
    elif write:
        require_project_edit(db, artifact.project_id, user)
    else:
        require_project_view(db, artifact.project_id, user)
    return artifact, artifact.owner_username


@router.post('/upload', response_model=ArtifactOut)
def upload_artifact(
    artifact_type: str = Query(default='artifact'), project_id: int | None = Query(default=None),
    run_id: int | None = Query(default=None), node_id: str | None = Query(default=None),
    file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model),
    _: None = Depends(rate_limit('artifact_upload', limit=get_settings().upload_rate_limit_per_minute)),
):
    owner = _scope_owner(db, project_id, current_user, write=True)
    return create_artifact_from_upload(db, upload=file, owner_username=owner, artifact_type=artifact_type, project_id=project_id, run_id=run_id, node_id=node_id)


@router.get('', response_model=list[ArtifactOut])
def list_artifacts(
    project_id: int | None = None, run_id: int | None = None, node_id: str | None = None,
    artifact_type: str | None = None, include_internal: bool = False,
    limit: int = Query(default=50, ge=1), offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model),
):
    owner = _scope_owner(db, project_id, current_user)
    return artifact_repository.list_for_owner(db, owner_username=owner, project_id=project_id, run_id=run_id, node_id=node_id, artifact_type=artifact_type, include_internal=include_internal, limit=min(limit, get_settings().api_max_page_size), offset=offset)


@router.get('/usage', response_model=ArtifactUsageOut)
def artifact_usage(project_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    return usage_payload(db, owner_username=_scope_owner(db, project_id, current_user), project_id=project_id)


@router.get('/cache/stats')
def cache_stats(project_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    owner = _scope_owner(db, project_id, current_user)
    query = db.query(func.count(NodeCacheEntry.id), func.coalesce(func.sum(NodeCacheEntry.size_bytes), 0), func.coalesce(func.sum(NodeCacheEntry.hit_count), 0)).filter(NodeCacheEntry.owner_username == owner, NodeCacheEntry.status == 'available')
    if project_id is not None: query = query.filter(NodeCacheEntry.project_id == project_id)
    count, size_bytes, hits = query.one()
    return {'project_id': project_id, 'entries': int(count or 0), 'size_bytes': int(size_bytes or 0), 'hits': int(hits or 0)}


@router.delete('/cache')
def clear_cache(project_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    owner = _scope_owner(db, project_id, current_user, write=True)
    removed = clear_project_cache(db, owner_username=owner, project_id=project_id); db.commit()
    return {'ok': True, 'removed': removed}


@router.get('/{artifact_id}/lineage')
def artifact_lineage(artifact_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    artifact, owner = _artifact_and_owner(db, artifact_id, current_user)
    parents = db.query(ArtifactLineage).join(Artifact, Artifact.id == ArtifactLineage.parent_artifact_id).filter(ArtifactLineage.child_artifact_id == artifact.id, Artifact.owner_username == owner).all()
    children = db.query(ArtifactLineage).join(Artifact, Artifact.id == ArtifactLineage.child_artifact_id).filter(ArtifactLineage.parent_artifact_id == artifact.id, Artifact.owner_username == owner).all()
    return {'artifact_id': artifact.id, 'parents': [{'artifact_id': item.parent_artifact_id, 'input_name': item.input_name, 'source_node_id': item.source_node_id} for item in parents], 'children': [{'artifact_id': item.child_artifact_id, 'input_name': item.input_name, 'target_node_id': item.target_node_id} for item in children]}


@router.get('/{artifact_id}', response_model=ArtifactOut)
def get_artifact(artifact_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    artifact, _ = _artifact_and_owner(db, artifact_id, current_user)
    return artifact


@router.get('/{artifact_id}/download-url', response_model=ArtifactDownloadOut)
def get_download_url(artifact_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner = _artifact_and_owner(db, artifact_id, current_user)
    return {'artifact_id': artifact_id, 'url': artifact_download_url(db, artifact_id, owner), 'expires_in_seconds': get_settings().artifact_signed_url_ttl_seconds}


@router.get('/{artifact_id}/download', include_in_schema=True)
def download_artifact(artifact_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    artifact, owner = _artifact_and_owner(db, artifact_id, current_user)
    if artifact.storage_backend == 'minio': return RedirectResponse(artifact_download_url(db, artifact_id, owner))
    path = materialize_artifact(db, artifact.id, cache_group='downloads')
    return FileResponse(path, filename=artifact.original_filename, media_type=artifact.content_type)


@router.delete('/{artifact_id}')
def remove_artifact(artifact_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner = _artifact_and_owner(db, artifact_id, current_user, write=True)
    delete_artifact(db, artifact_id, owner); db.commit()
    return {'ok': True}
