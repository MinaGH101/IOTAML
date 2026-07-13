from __future__ import annotations

import shutil
from datetime import timedelta
from pathlib import Path

from app.config import get_settings
from app.infrastructure.storage.base import StorageBackend


class LocalStorageBackend(StorageBackend):
    name = "local"

    def __init__(self) -> None:
        self.root = Path(get_settings().storage_dir) / "objects"

    def _path(self, object_key: str) -> Path:
        clean = object_key.strip("/").replace("..", "_")
        return self.root / clean

    def ensure_ready(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def upload_file(self, source: Path, object_key: str, content_type: str) -> None:
        del content_type
        self.ensure_ready()
        target = self._path(object_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

    def download_file(self, object_key: str, destination: Path) -> Path:
        source = self._path(object_key)
        if not source.exists():
            raise FileNotFoundError(object_key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        return destination

    def delete(self, object_key: str) -> None:
        path = self._path(object_key)
        if path.exists():
            path.unlink()

    def exists(self, object_key: str) -> bool:
        return self._path(object_key).exists()

    def presigned_get(self, object_key: str, expires: timedelta) -> str:
        del expires
        return f"/api/artifacts/by-key/download?object_key={object_key}"

    def health(self) -> dict[str, object]:
        self.ensure_ready()
        return {"backend": self.name, "status": "ok", "root": str(self.root)}
