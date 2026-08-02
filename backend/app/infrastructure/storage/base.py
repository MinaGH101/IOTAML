"""Canonical object-storage interface used by domains and maintenance jobs."""

from __future__ import annotations

from abc import ABC, abstractmethod
from contextlib import contextmanager
from datetime import timedelta
from pathlib import Path
from typing import BinaryIO, Iterator


class StorageBackend(ABC):
    name: str

    @abstractmethod
    def ensure_ready(self) -> None: ...

    @abstractmethod
    def put(self, source: Path, object_key: str, content_type: str) -> None: ...

    @abstractmethod
    def get(self, object_key: str, destination: Path) -> Path: ...

    @abstractmethod
    def open(self, object_key: str) -> BinaryIO: ...

    @abstractmethod
    def delete(self, object_key: str) -> None: ...

    @abstractmethod
    def exists(self, object_key: str) -> bool: ...

    @abstractmethod
    def copy(self, source_key: str, target_key: str) -> None: ...

    def move(self, source_key: str, target_key: str) -> None:
        self.copy(source_key, target_key)
        self.delete(source_key)

    @abstractmethod
    def stat(self, object_key: str) -> dict[str, object]: ...

    @abstractmethod
    def iter_keys(self, prefix: str = '', *, limit: int | None = None) -> Iterator[str]: ...

    @abstractmethod
    def presigned_get(self, object_key: str, expires: timedelta) -> str: ...

    @abstractmethod
    def health(self) -> dict[str, object]: ...

    # Compatibility names retained at the infrastructure boundary only.
    def upload_file(self, source: Path, object_key: str, content_type: str) -> None:
        self.put(source, object_key, content_type)

    def download_file(self, object_key: str, destination: Path) -> Path:
        return self.get(object_key, destination)

    @contextmanager
    def reader(self, object_key: str):
        stream = self.open(object_key)
        try:
            yield stream
        finally:
            stream.close()
