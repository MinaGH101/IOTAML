from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import timedelta
from pathlib import Path


class StorageBackend(ABC):
    name: str

    @abstractmethod
    def ensure_ready(self) -> None: ...

    @abstractmethod
    def upload_file(self, source: Path, object_key: str, content_type: str) -> None: ...

    @abstractmethod
    def download_file(self, object_key: str, destination: Path) -> Path: ...

    @abstractmethod
    def delete(self, object_key: str) -> None: ...

    @abstractmethod
    def exists(self, object_key: str) -> bool: ...

    @abstractmethod
    def presigned_get(self, object_key: str, expires: timedelta) -> str: ...

    @abstractmethod
    def health(self) -> dict[str, object]: ...
