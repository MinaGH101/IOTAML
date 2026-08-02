"""Bounded, idempotent operational maintenance commands.

Usage examples::

    python -m app.workers.maintenance artifacts --dry-run
    python -m app.workers.maintenance stale-runs
    python -m app.workers.maintenance cache --dry-run
    python -m app.workers.maintenance all --dry-run
"""
from __future__ import annotations

import argparse
import json
import logging
from contextlib import contextmanager
from datetime import timedelta
from typing import Any, Iterator

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.logging import configure_logging
from app.domains.artifacts.models import Artifact, NodeCacheEntry
from app.domains.artifacts.service import cleanup_expired_artifacts, reconcile_artifacts
from app.domains.runs.models import Run, RunEvent
from app.infrastructure.queue.repository import recover_stale_runs
from app.infrastructure.queue.state import utcnow
from app.workflow.caching.service import cleanup_node_cache
from app.workers.reliable_worker import cleanup_old_runtime_directories

logger = logging.getLogger("iota.maintenance")

_LOCK_IDS = {
    "artifacts": 8_417_001,
    "stale-runs": 8_417_002,
    "cache": 8_417_003,
    "logs": 8_417_004,
    "all": 8_417_005,
}


@contextmanager
def maintenance_lock(db: Session, name: str) -> Iterator[bool]:
    """Use a PostgreSQL advisory lock; SQLite/test runs remain single-process."""
    if db.bind is None or db.bind.dialect.name != "postgresql":
        yield True
        return
    lock_id = _LOCK_IDS[name]
    acquired = bool(db.execute(text("SELECT pg_try_advisory_lock(:lock_id)"), {"lock_id": lock_id}).scalar())
    try:
        yield acquired
    finally:
        if acquired:
            db.execute(text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": lock_id})


def stale_run_job(db: Session, *, dry_run: bool) -> dict[str, Any]:
    if dry_run:
        threshold = utcnow() - timedelta(seconds=get_settings().job_stale_after_seconds)
        count = db.scalar(select(func.count(Run.id)).where(Run.status == "running", Run.heartbeat_at < threshold)) or 0
        return {"stale_runs": int(count), "recovered_ids": []}
    ids = recover_stale_runs(db)
    return {"stale_runs": len(ids), "recovered_ids": ids[:100]}


def cache_job(db: Session, *, dry_run: bool) -> dict[str, Any]:
    now = utcnow()
    query = select(func.count(NodeCacheEntry.id)).where(
        NodeCacheEntry.status == "available",
        NodeCacheEntry.pinned.is_(False),
        NodeCacheEntry.expires_at.is_not(None),
        NodeCacheEntry.expires_at <= now,
    )
    count = int(db.scalar(query) or 0)
    removed = 0 if dry_run else cleanup_node_cache(db)
    return {"expired_cache_entries": count, "removed": int(removed)}


def logs_job(db: Session, *, dry_run: bool, retention_days: int = 30) -> dict[str, Any]:
    cutoff = utcnow() - timedelta(days=retention_days)
    old_events = int(db.scalar(select(func.count(RunEvent.id)).where(RunEvent.created_at < cutoff)) or 0)
    trimmed_runs = 0
    for run in db.scalars(select(Run).where(func.json_array_length(Run.logs) > 250).limit(200)).all() if db.bind and db.bind.dialect.name == "sqlite" else []:
        trimmed_runs += 1
        if not dry_run:
            run.logs = list(run.logs or [])[-250:]
    if not dry_run:
        db.execute(delete(RunEvent).where(RunEvent.created_at < cutoff))
    return {"old_run_events": old_events, "trimmed_run_rows": trimmed_runs}


def usage_job(db: Session) -> dict[str, Any]:
    rows = db.execute(
        select(Artifact.owner_username, func.count(Artifact.id), func.coalesce(func.sum(Artifact.size_bytes), 0))
        .where(Artifact.status == "available", Artifact.deleted_at.is_(None))
        .group_by(Artifact.owner_username)
        .limit(1000)
    ).all()
    return {
        "owners": len(rows),
        "usage": [
            {"owner_username": owner, "artifact_count": int(count), "size_bytes": int(size)}
            for owner, count, size in rows
        ],
    }


def dead_letter_job(db: Session) -> dict[str, Any]:
    rows = db.execute(
        select(Run.id, Run.owner_username, Run.project_id, Run.failure_code, Run.finished_at)
        .where(Run.status == "dead_letter")
        .order_by(Run.finished_at.desc(), Run.id.desc())
        .limit(200)
    ).all()
    return {
        "count": len(rows),
        "runs": [
            {"run_id": run_id, "owner_username": owner, "project_id": project_id, "failure_code": code, "finished_at": finished_at.isoformat() if finished_at else None}
            for run_id, owner, project_id, code, finished_at in rows
        ],
    }


def run_command(command: str, *, dry_run: bool, verify_checksums: bool = False) -> dict[str, Any]:
    summary: dict[str, Any] = {"command": command, "dry_run": dry_run}
    with SessionLocal() as db, maintenance_lock(db, command if command in _LOCK_IDS else "all") as acquired:
        if not acquired:
            return {**summary, "skipped": True, "reason": "another maintenance process holds the lock"}
        commands = {command} if command != "all" else {"artifacts", "stale-runs", "cache", "logs", "runtime", "usage", "dead-letter"}
        if "artifacts" in commands:
            summary["artifacts"] = reconcile_artifacts(db, dry_run=dry_run, verify_checksums=verify_checksums)
            summary["expired_artifacts"] = 0 if dry_run else cleanup_expired_artifacts(db)
        if "stale-runs" in commands:
            summary["stale_runs"] = stale_run_job(db, dry_run=dry_run)
        if "cache" in commands:
            summary["cache"] = cache_job(db, dry_run=dry_run)
        if "logs" in commands:
            summary["logs"] = logs_job(db, dry_run=dry_run)
        if "runtime" in commands:
            summary["runtime_directories_removed"] = 0 if dry_run else cleanup_old_runtime_directories()
        if "usage" in commands:
            summary["storage_usage"] = usage_job(db)
        if "dead-letter" in commands:
            summary["dead_letter"] = dead_letter_job(db)
        if dry_run:
            db.rollback()
        else:
            db.commit()
    logger.info("Maintenance completed", extra={"maintenance": summary})
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="IOTA ML maintenance jobs")
    parser.add_argument("command", choices=["artifacts", "stale-runs", "cache", "logs", "runtime", "usage", "dead-letter", "all"])
    parser.add_argument("--dry-run", action="store_true", help="Report changes without mutating data or storage")
    parser.add_argument("--verify-checksums", action="store_true", help="Read and hash available artifacts during reconciliation")
    args = parser.parse_args()
    configure_logging()
    print(json.dumps(run_command(args.command, dry_run=args.dry_run, verify_checksums=args.verify_checksums), ensure_ascii=False, default=str, indent=2))


if __name__ == "__main__":
    main()
