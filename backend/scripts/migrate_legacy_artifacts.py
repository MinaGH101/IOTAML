"""Move legacy dataset files from local disk into the configured artifact backend.

Run inside the backend container after migrations:
    python scripts/migrate_legacy_artifacts.py
"""
from __future__ import annotations

from pathlib import Path

from app.database import SessionLocal
from app.domains.artifacts.service import create_artifact_from_path
from app.models import Dataset


def main() -> None:
    migrated = 0
    skipped = 0
    with SessionLocal() as db:
        for dataset in db.query(Dataset).filter(Dataset.artifact_id.is_(None)).all():
            path = Path(dataset.path)
            if not path.is_file():
                skipped += 1
                continue
            artifact = create_artifact_from_path(
                db,
                source_path=path,
                owner_username='admin',
                artifact_type='dataset',
                project_id=dataset.project_id,
            )
            dataset.artifact_id = artifact.id
            dataset.path = f'artifact://{artifact.id}'
            dataset.content_type = artifact.content_type
            dataset.size_bytes = artifact.size_bytes
            dataset.checksum_sha256 = artifact.checksum_sha256
            migrated += 1
        db.commit()
    print({'migrated': migrated, 'skipped': skipped})


if __name__ == '__main__':
    main()
