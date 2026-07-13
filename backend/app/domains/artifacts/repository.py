from __future__ import annotations

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.domains.artifacts.models import Artifact


class ArtifactRepository:
    def get(self, db: Session, artifact_id: int) -> Artifact | None:
        return db.get(Artifact, artifact_id)

    def list_for_owner(
        self,
        db: Session,
        *,
        owner_username: str,
        project_id: int | None = None,
        run_id: int | None = None,
        node_id: str | None = None,
        artifact_type: str | None = None,
        include_deleted: bool = False,
    ) -> list[Artifact]:
        query = db.query(Artifact).filter(Artifact.owner_username == owner_username)
        if not include_deleted:
            query = query.filter(Artifact.deleted_at.is_(None), Artifact.status == "available")
        if project_id is not None:
            query = query.filter(Artifact.project_id == project_id)
        if run_id is not None:
            query = query.filter(Artifact.run_id == run_id)
        if node_id is not None:
            query = query.filter(Artifact.node_id == node_id)
        if artifact_type:
            query = query.filter(Artifact.artifact_type == artifact_type)
        return query.order_by(Artifact.created_at.desc()).all()

    def add(self, db: Session, artifact: Artifact) -> Artifact:
        db.add(artifact)
        db.flush()
        return artifact

    def usage(self, db: Session, *, owner_username: str, project_id: int | None = None) -> tuple[int, int, dict[str, int]]:
        query = db.query(
            func.coalesce(func.sum(Artifact.size_bytes), 0),
            func.count(Artifact.id),
        ).filter(
            Artifact.owner_username == owner_username,
            Artifact.deleted_at.is_(None),
            Artifact.status == "available",
        )
        if project_id is not None:
            query = query.filter(Artifact.project_id == project_id)
        total, count = query.one()

        by_type_query = db.query(
            Artifact.artifact_type,
            func.coalesce(func.sum(Artifact.size_bytes), 0),
        ).filter(
            Artifact.owner_username == owner_username,
            Artifact.deleted_at.is_(None),
            Artifact.status == "available",
        )
        if project_id is not None:
            by_type_query = by_type_query.filter(Artifact.project_id == project_id)
        by_type = {str(name): int(size) for name, size in by_type_query.group_by(Artifact.artifact_type).all()}
        return int(total or 0), int(count or 0), by_type


    def latest_version(
        self,
        db: Session,
        *,
        owner_username: str,
        project_id: int | None,
        artifact_type: str,
        logical_name: str,
    ) -> Artifact | None:
        return (
            db.query(Artifact)
            .filter(
                Artifact.owner_username == owner_username,
                Artifact.project_id == project_id,
                Artifact.artifact_type == artifact_type,
                Artifact.logical_name == logical_name,
                Artifact.deleted_at.is_(None),
            )
            .order_by(Artifact.version.desc())
            .first()
        )

    def expired(self, db: Session, now: datetime, limit: int = 200) -> list[Artifact]:
        return (
            db.query(Artifact)
            .filter(
                Artifact.status == "available",
                Artifact.deleted_at.is_(None),
                Artifact.expires_at.is_not(None),
                Artifact.expires_at <= now,
            )
            .order_by(Artifact.expires_at.asc())
            .limit(limit)
            .all()
        )


artifact_repository = ArtifactRepository()
