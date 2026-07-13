from __future__ import annotations

from functools import lru_cache

from app.config import get_settings
from app.infrastructure.storage.base import StorageBackend
from app.infrastructure.storage.local import LocalStorageBackend
from app.infrastructure.storage.minio_backend import MinioStorageBackend


@lru_cache(maxsize=1)
def get_storage_backend() -> StorageBackend:
    backend = get_settings().storage_backend.strip().lower()
    if backend == "minio":
        return MinioStorageBackend()
    if backend == "local":
        return LocalStorageBackend()
    raise RuntimeError(f"Unsupported storage backend: {backend}")
