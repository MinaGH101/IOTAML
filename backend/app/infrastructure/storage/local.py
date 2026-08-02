"""Local immutable-object storage implementation for development and tests."""

from __future__ import annotations

import shutil
from datetime import timedelta
from pathlib import Path
from typing import BinaryIO, Iterator

from app.core.config import get_settings
from app.infrastructure.storage.base import StorageBackend


class LocalStorageBackend(StorageBackend):
    name = 'local'

    def __init__(self) -> None:
        self.root = Path(get_settings().storage_dir) / 'objects'

    def _path(self, object_key: str) -> Path:
        normalized = str(object_key).replace('\\', '/').strip('/')
        parts = Path(normalized).parts
        if not normalized or any(part in {'', '.', '..'} for part in parts):
            raise ValueError('Unsafe object key.')
        candidate = (self.root / Path(*parts)).resolve()
        root = self.root.resolve()
        if root != candidate and root not in candidate.parents:
            raise ValueError('Unsafe object key.')
        return candidate

    def ensure_ready(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def put(self, source: Path, object_key: str, content_type: str) -> None:
        del content_type
        self.ensure_ready()
        target = self._path(object_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(target.name + '.partial')
        shutil.copy2(source, temporary)
        temporary.replace(target)

    def get(self, object_key: str, destination: Path) -> Path:
        source = self._path(object_key)
        if not source.is_file():
            raise FileNotFoundError(object_key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        return destination

    def open(self, object_key: str) -> BinaryIO:
        return self._path(object_key).open('rb')

    def delete(self, object_key: str) -> None:
        path = self._path(object_key)
        path.unlink(missing_ok=True)

    def exists(self, object_key: str) -> bool:
        return self._path(object_key).is_file()

    def copy(self, source_key: str, target_key: str) -> None:
        source = self._path(source_key)
        if not source.is_file():
            raise FileNotFoundError(source_key)
        target = self._path(target_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

    def move(self, source_key: str, target_key: str) -> None:
        source = self._path(source_key)
        if not source.is_file():
            raise FileNotFoundError(source_key)
        target = self._path(target_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        source.replace(target)

    def stat(self, object_key: str) -> dict[str, object]:
        path = self._path(object_key)
        stat = path.stat()
        return {'object_key': object_key, 'size_bytes': stat.st_size, 'modified_at': stat.st_mtime}

    def iter_keys(self, prefix: str = '', *, limit: int | None = None) -> Iterator[str]:
        self.ensure_ready()
        start = self._path(prefix) if prefix else self.root
        if start.is_file():
            yield str(start.relative_to(self.root)).replace('\\', '/')
            return
        if not start.exists():
            return
        count = 0
        for path in start.rglob('*'):
            if path.is_file() and not path.name.endswith('.partial'):
                yield str(path.relative_to(self.root)).replace('\\', '/')
                count += 1
                if limit is not None and count >= limit:
                    return

    def presigned_get(self, object_key: str, expires: timedelta) -> str:
        del expires
        return f'/api/artifacts/by-key/download?object_key={object_key}'

    def health(self) -> dict[str, object]:
        self.ensure_ready()
        return {'backend': self.name, 'status': 'ok', 'root': str(self.root)}
