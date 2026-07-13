from __future__ import annotations

from io import BytesIO
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.domains.artifacts.models import Artifact
from app.domains.artifacts.service import create_artifact_from_upload, delete_artifact, materialize_artifact, usage_payload
from app.infrastructure.storage.service import get_storage_backend


def make_session(tmp_path: Path) -> Session:
    # The test environment uses the local backend from conftest.py.
    get_storage_backend.cache_clear()
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    return Session(engine)


def test_local_artifact_round_trip_and_usage(tmp_path: Path) -> None:
    with make_session(tmp_path) as db:
        upload = UploadFile(filename='sample.csv', file=BytesIO(b'a,b\n1,2\n'), headers={'content-type': 'text/csv'})
        artifact = create_artifact_from_upload(
            db,
            upload=upload,
            owner_username='admin',
            project_id=7,
            artifact_type='dataset',
            allowed_extensions={'.csv'},
            allowed_content_types={'text/csv'},
        )
        assert artifact.id is not None
        assert artifact.checksum_sha256
        path = materialize_artifact(db, artifact.id, cache_group='tests')
        assert path.read_bytes() == b'a,b\n1,2\n'
        usage = usage_payload(db, owner_username='admin', project_id=7)
        assert usage['artifact_count'] == 1
        assert usage['total_bytes'] == len(b'a,b\n1,2\n')

        delete_artifact(db, artifact.id, 'admin', force=True)
        db.commit()
        stored = db.get(Artifact, artifact.id)
        assert stored is not None
        assert stored.status == 'deleted'
