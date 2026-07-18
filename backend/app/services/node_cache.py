from __future__ import annotations

import hashlib
from datetime import timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.domains.artifacts.models import Artifact, ArtifactLineage, NodeCacheEntry, NodeExecution
from app.domains.artifacts.service import create_artifact_from_path, delete_artifact, materialize_artifact
from app.models import Run
from app.services.node_cache_keys import static_fingerprint
from app.services.run_state import utcnow


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def prepare_cache_manifest(db: Session, run: Run, cache_dir: Path) -> dict[str, Any]:
    settings = get_settings()
    if (
        not settings.node_cache_enabled
        or run.bypass_cache
        or run.project_id is None
        or run.workflow_id is None
    ):
        return {"enabled": False, "entries": {}, "static": {}}

    nodes = (run.workflow_graph or {}).get("nodes") or []
    static: dict[str, dict[str, Any]] = {}
    fingerprints: set[str] = set()
    for node in nodes:
        node_id = str(node.get("id"))
        fingerprint, policy = static_fingerprint(node)
        static[node_id] = {"static_fingerprint": fingerprint, **policy}
        if policy["cacheable"]:
            fingerprints.add(fingerprint)

    if not fingerprints:
        return {"enabled": True, "entries": {}, "static": static}

    query = (
        db.query(NodeCacheEntry)
        .filter(
            NodeCacheEntry.owner_username == run.owner_username,
            NodeCacheEntry.project_id == run.project_id,
            NodeCacheEntry.static_fingerprint.in_(fingerprints),
            NodeCacheEntry.status == "available",
        )
        .order_by(NodeCacheEntry.last_accessed_at.desc())
    )
    candidates = query.all()
    per_fingerprint: dict[str, int] = {}
    entries: dict[str, dict[str, Any]] = {}
    cache_dir.mkdir(parents=True, exist_ok=True)
    for entry in candidates:
        count = per_fingerprint.get(entry.static_fingerprint, 0)
        if count >= settings.node_cache_candidates_per_fingerprint:
            continue
        artifact = db.get(Artifact, entry.artifact_id)
        if not artifact or artifact.status != "available" or artifact.deleted_at is not None:
            entry.status = "invalid"
            continue
        try:
            source = materialize_artifact(db, artifact.id, cache_group="node-cache")
            target = cache_dir / f"{entry.cache_key}.joblib"
            if not target.exists() or target.stat().st_size != source.stat().st_size:
                target.write_bytes(source.read_bytes())
            if _sha256_file(target) != artifact.checksum_sha256:
                target.unlink(missing_ok=True)
                entry.status = "invalid"
                continue
        except Exception:
            entry.status = "invalid"
            continue
        entries[entry.cache_key] = {
            "cache_entry_id": entry.id,
            "artifact_id": artifact.id,
            "path": str(target),
            "checksum_sha256": artifact.checksum_sha256,
            "output_digest": entry.output_digest,
            "source_run_id": entry.source_run_id,
            "node_type": entry.node_type,
            "node_version": entry.node_version,
            "size_bytes": entry.size_bytes,
        }
        per_fingerprint[entry.static_fingerprint] = count + 1
    db.flush()
    return {"enabled": True, "entries": entries, "static": static}


def _upsert_execution(db: Session, *, run: Run, record: dict[str, Any], artifact_id: int | None, cache_entry_id: int | None) -> NodeExecution:
    node_id = str(record.get("node_id"))
    execution = db.query(NodeExecution).filter(NodeExecution.run_id == run.id, NodeExecution.node_id == node_id).first()
    if execution is None:
        execution = NodeExecution(run_id=run.id, workflow_id=run.workflow_id, node_id=node_id, node_type=str(record.get("node_type") or "unknown"), status=str(record.get("status") or "succeeded"))
        db.add(execution)
    execution.workflow_id = run.workflow_id
    execution.node_type = str(record.get("node_type") or execution.node_type)
    execution.status = str(record.get("status") or execution.status)
    execution.cache_key = record.get("cache_key")
    execution.cache_hit = bool(record.get("cache_hit"))
    execution.cache_entry_id = cache_entry_id
    execution.artifact_id = artifact_id
    execution.output_digest = record.get("output_digest")
    execution.duration_ms = record.get("duration_ms")
    execution.error = record.get("error")
    execution.started_at = _parse_datetime(record.get("started_at"))
    execution.finished_at = _parse_datetime(record.get("finished_at"))
    execution.metadata_json = {
        "source_run_id": record.get("source_run_id"),
        "size_bytes": record.get("size_bytes"),
        "parent_nodes": record.get("parent_nodes") or [],
    }
    return execution


def _parse_datetime(value: Any):
    if not value:
        return None
    from datetime import datetime
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def persist_run_cache_records(db: Session, run: Run, records: list[dict[str, Any]]) -> dict[str, int]:
    settings = get_settings()
    if not records:
        return {"hits": 0, "writes": 0, "bytes_written": 0}

    artifact_by_node: dict[str, int] = {}
    hits = 0
    writes = 0
    bytes_written = 0
    statuses = dict(run.node_statuses or {})

    for record in records:
        node_id = str(record.get("node_id") or "")
        if not node_id:
            continue
        cache_hit = bool(record.get("cache_hit"))
        cache_entry: NodeCacheEntry | None = None
        artifact_id: int | None = None

        if cache_hit:
            cache_entry_id = int(record.get("cache_entry_id") or 0)
            cache_entry = db.get(NodeCacheEntry, cache_entry_id) if cache_entry_id else None
            if cache_entry and cache_entry.status == "available":
                cache_entry.hit_count += 1
                cache_entry.last_accessed_at = utcnow()
                artifact_id = cache_entry.artifact_id
                hits += 1
        elif settings.node_cache_enabled and record.get("cacheable") and record.get("path"):
            source_path = Path(str(record["path"]))
            if source_path.is_file():
                cache_entry = (
                    db.query(NodeCacheEntry)
                    .filter(
                        NodeCacheEntry.owner_username == run.owner_username,
                        NodeCacheEntry.project_id == run.project_id,
                        NodeCacheEntry.cache_key == str(record.get("cache_key")),
                        NodeCacheEntry.status == "available",
                    )
                    .first()
                )
                if cache_entry:
                    artifact_id = cache_entry.artifact_id
                    cache_entry.last_accessed_at = utcnow()
                else:
                    artifact = create_artifact_from_path(
                        db,
                        source_path=source_path,
                        owner_username=run.owner_username,
                        artifact_type="node_cache",
                        project_id=run.project_id,
                        workflow_id=run.workflow_id,
                        run_id=run.id,
                        node_id=node_id,
                        expires_in_days=settings.node_cache_retention_days,
                        logical_name=f"{record.get('node_type', 'node')}-{record.get('cache_key')}.joblib",
                        content_type_override="application/x-iota-node-cache",
                        cache_key=str(record.get("cache_key")),
                        metadata_json={
                            "format": "joblib",
                            "format_version": 1,
                            "node_type": record.get("node_type"),
                            "node_version": record.get("node_version"),
                            "output_digest": record.get("output_digest"),
                            "source_run_id": run.id,
                        },
                    )
                    cache_entry = NodeCacheEntry(
                        owner_username=run.owner_username,
                        project_id=run.project_id,
                        workflow_id=run.workflow_id,
                        source_run_id=run.id,
                        node_id=node_id,
                        node_type=str(record.get("node_type") or "unknown"),
                        node_version=str(record.get("node_version") or "1"),
                        static_fingerprint=str(record.get("static_fingerprint") or ""),
                        cache_key=str(record.get("cache_key") or ""),
                        output_digest=str(record.get("output_digest") or artifact.checksum_sha256),
                        artifact_id=artifact.id,
                        size_bytes=artifact.size_bytes,
                        status="available",
                        metadata_json={"workflow_revision": run.workflow_revision},
                        expires_at=utcnow() + timedelta(days=settings.node_cache_retention_days),
                        last_accessed_at=utcnow(),
                    )
                    try:
                        with db.begin_nested():
                            db.add(cache_entry)
                            db.flush()
                    except IntegrityError:
                        existing = (
                            db.query(NodeCacheEntry)
                            .filter(
                                NodeCacheEntry.owner_username == run.owner_username,
                                NodeCacheEntry.project_id == run.project_id,
                                NodeCacheEntry.cache_key == str(record.get("cache_key")),
                            )
                            .first()
                        )
                        if existing is None:
                            raise
                        delete_artifact(db, artifact.id, run.owner_username, force=True)
                        cache_entry = existing
                    artifact_id = cache_entry.artifact_id
                    writes += 1
                    bytes_written += int(record.get("size_bytes") or source_path.stat().st_size)

        if artifact_id:
            artifact_by_node[node_id] = artifact_id
        _upsert_execution(db, run=run, record=record, artifact_id=artifact_id, cache_entry_id=cache_entry.id if cache_entry else None)

        status_item = dict(statuses.get(node_id) or {})
        status_item.update({
            "cache_hit": cache_hit,
            "cache_key": record.get("cache_key"),
            "artifact_id": artifact_id,
            "source_run_id": record.get("source_run_id") if cache_hit else run.id,
            "output_size_bytes": record.get("size_bytes"),
        })
        statuses[node_id] = status_item

    # Build lineage after every node has an artifact id.
    for record in records:
        child_id = artifact_by_node.get(str(record.get("node_id") or ""))
        if not child_id:
            continue
        for parent in record.get("parent_nodes") or []:
            parent_node_id = str(parent.get("node_id") or "")
            parent_id = artifact_by_node.get(parent_node_id) or parent.get("artifact_id")
            if not parent_id or int(parent_id) == int(child_id):
                continue
            exists = db.query(ArtifactLineage).filter(
                ArtifactLineage.parent_artifact_id == int(parent_id),
                ArtifactLineage.child_artifact_id == int(child_id),
                ArtifactLineage.input_name == str(parent.get("input_name") or "input"),
            ).first()
            if not exists:
                db.add(ArtifactLineage(
                    parent_artifact_id=int(parent_id),
                    child_artifact_id=int(child_id),
                    input_name=str(parent.get("input_name") or "input"),
                    source_node_id=parent_node_id or None,
                    target_node_id=str(record.get("node_id") or "") or None,
                ))

    run.node_statuses = statuses
    db.flush()
    return {"hits": hits, "writes": writes, "bytes_written": bytes_written}


def cleanup_node_cache(db: Session) -> int:
    settings = get_settings()
    now = utcnow()
    candidates = (
        db.query(NodeCacheEntry)
        .filter(
            NodeCacheEntry.status == "available",
            NodeCacheEntry.pinned.is_(False),
            NodeCacheEntry.expires_at.is_not(None),
            NodeCacheEntry.expires_at <= now,
        )
        .order_by(NodeCacheEntry.last_accessed_at.asc())
        .limit(settings.node_cache_cleanup_batch_size)
        .all()
    )
    removed = 0
    for entry in candidates:
        artifact = db.get(Artifact, entry.artifact_id)
        try:
            if artifact and artifact.status == "available":
                delete_artifact(db, artifact.id, entry.owner_username, force=True)
            entry.status = "expired"
            removed += 1
        except Exception:
            continue

    # Enforce a project-level LRU ceiling without touching pinned cache entries.
    projects = db.query(NodeCacheEntry.owner_username, NodeCacheEntry.project_id).filter(NodeCacheEntry.status == "available").distinct().all()
    for owner, project_id in projects:
        total = int(db.query(func.coalesce(func.sum(NodeCacheEntry.size_bytes), 0)).filter(
            NodeCacheEntry.owner_username == owner,
            NodeCacheEntry.project_id == project_id,
            NodeCacheEntry.status == "available",
        ).scalar() or 0)
        if total <= settings.node_cache_max_bytes_per_project:
            continue
        lru = db.query(NodeCacheEntry).filter(
            NodeCacheEntry.owner_username == owner,
            NodeCacheEntry.project_id == project_id,
            NodeCacheEntry.status == "available",
            NodeCacheEntry.pinned.is_(False),
        ).order_by(NodeCacheEntry.last_accessed_at.asc()).all()
        for entry in lru:
            if total <= settings.node_cache_max_bytes_per_project:
                break
            artifact = db.get(Artifact, entry.artifact_id)
            try:
                if artifact and artifact.status == "available":
                    delete_artifact(db, artifact.id, owner, force=True)
                entry.status = "evicted"
                total -= entry.size_bytes
                removed += 1
            except Exception:
                continue
    db.flush()
    return removed


def clear_project_cache(db: Session, *, owner_username: str, project_id: int | None) -> int:
    entries = db.query(NodeCacheEntry).filter(
        NodeCacheEntry.owner_username == owner_username,
        NodeCacheEntry.project_id == project_id,
        NodeCacheEntry.status == "available",
        NodeCacheEntry.pinned.is_(False),
    ).all()
    removed = 0
    for entry in entries:
        artifact = db.get(Artifact, entry.artifact_id)
        if artifact and artifact.status == "available":
            delete_artifact(db, artifact.id, owner_username, force=True)
        entry.status = "cleared"
        removed += 1
    db.flush()
    return removed
