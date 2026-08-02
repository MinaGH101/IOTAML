"""Package initialization for the IOTA ML app infrastructure storage package."""

from app.infrastructure.storage.base import StorageBackend
from app.infrastructure.storage.service import get_storage_backend

__all__ = ["StorageBackend", "get_storage_backend"]
