from __future__ import annotations

from datetime import timedelta
from pathlib import Path

from minio import Minio
from minio.error import S3Error

from app.config import get_settings
from app.infrastructure.storage.base import StorageBackend


class MinioStorageBackend(StorageBackend):
    name = "minio"

    def __init__(self) -> None:
        settings = get_settings()
        self.bucket = settings.artifact_bucket
        self.client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        self.public_client = Minio(
            settings.minio_public_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )

    def ensure_ready(self) -> None:
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)

    def upload_file(self, source: Path, object_key: str, content_type: str) -> None:
        self.ensure_ready()
        self.client.fput_object(self.bucket, object_key, str(source), content_type=content_type)

    def download_file(self, object_key: str, destination: Path) -> Path:
        destination.parent.mkdir(parents=True, exist_ok=True)
        self.client.fget_object(self.bucket, object_key, str(destination))
        return destination

    def delete(self, object_key: str) -> None:
        self.client.remove_object(self.bucket, object_key)

    def exists(self, object_key: str) -> bool:
        try:
            self.client.stat_object(self.bucket, object_key)
            return True
        except S3Error as exc:
            if exc.code in {"NoSuchKey", "NoSuchObject", "NoSuchBucket"}:
                return False
            raise

    def presigned_get(self, object_key: str, expires: timedelta) -> str:
        return self.public_client.presigned_get_object(self.bucket, object_key, expires=expires)

    def health(self) -> dict[str, object]:
        self.ensure_ready()
        return {"backend": self.name, "status": "ok", "bucket": self.bucket}
