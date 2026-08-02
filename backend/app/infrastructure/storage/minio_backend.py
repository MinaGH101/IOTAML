"""MinIO implementation of the canonical object-storage interface."""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path
from typing import BinaryIO, Iterator

from app.core.config import get_settings
from app.infrastructure.storage.base import StorageBackend


class _MinioReader:
    def __init__(self, response) -> None:
        self.response = response
    def read(self, size: int = -1) -> bytes:
        return self.response.read(size)
    def close(self) -> None:
        self.response.close()
        self.response.release_conn()
    def __enter__(self):
        return self
    def __exit__(self, *_args):
        self.close()


class MinioStorageBackend(StorageBackend):
    name = 'minio'

    def __init__(self) -> None:
        from minio import Minio
        settings = get_settings()
        self.bucket = settings.artifact_bucket
        self.client = Minio(settings.minio_endpoint, access_key=settings.minio_access_key, secret_key=settings.minio_secret_key, secure=settings.minio_secure)
        self.public_client = Minio(settings.minio_public_endpoint, access_key=settings.minio_access_key, secret_key=settings.minio_secret_key, secure=settings.minio_secure)

    def ensure_ready(self) -> None:
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)

    def put(self, source: Path, object_key: str, content_type: str) -> None:
        self.ensure_ready()
        self.client.fput_object(self.bucket, object_key, str(source), content_type=content_type)

    def get(self, object_key: str, destination: Path) -> Path:
        destination.parent.mkdir(parents=True, exist_ok=True)
        self.client.fget_object(self.bucket, object_key, str(destination))
        return destination

    def open(self, object_key: str) -> BinaryIO:
        return _MinioReader(self.client.get_object(self.bucket, object_key))  # type: ignore[return-value]

    def delete(self, object_key: str) -> None:
        self.client.remove_object(self.bucket, object_key)

    def exists(self, object_key: str) -> bool:
        from minio.error import S3Error
        try:
            self.client.stat_object(self.bucket, object_key)
            return True
        except S3Error as exc:
            if exc.code in {'NoSuchKey', 'NoSuchObject', 'NoSuchBucket'}:
                return False
            raise

    def copy(self, source_key: str, target_key: str) -> None:
        from minio.commonconfig import CopySource
        self.client.copy_object(self.bucket, target_key, CopySource(self.bucket, source_key))

    def stat(self, object_key: str) -> dict[str, object]:
        value = self.client.stat_object(self.bucket, object_key)
        return {'object_key': object_key, 'size_bytes': int(value.size), 'etag': value.etag, 'modified_at': value.last_modified}

    def iter_keys(self, prefix: str = '', *, limit: int | None = None) -> Iterator[str]:
        count = 0
        for item in self.client.list_objects(self.bucket, prefix=prefix, recursive=True):
            yield str(item.object_name)
            count += 1
            if limit is not None and count >= limit:
                return

    def presigned_get(self, object_key: str, expires: timedelta) -> str:
        return self.public_client.presigned_get_object(self.bucket, object_key, expires=expires)

    def health(self) -> dict[str, object]:
        self.ensure_ready()
        return {'backend': self.name, 'status': 'ok', 'bucket': self.bucket}
