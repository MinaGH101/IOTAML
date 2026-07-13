from __future__ import annotations

import json
import sys
from pathlib import Path

from app.config import get_settings
from app.infrastructure.storage.minio_backend import MinioStorageBackend


def main(target: str) -> None:
    settings = get_settings()
    root = Path(target)
    root.mkdir(parents=True, exist_ok=True)
    backend = MinioStorageBackend()
    backend.ensure_ready()
    manifest: list[dict[str, object]] = []
    for item in backend.client.list_objects(backend.bucket, recursive=True):
        destination = root / item.object_name
        destination.parent.mkdir(parents=True, exist_ok=True)
        backend.client.fget_object(backend.bucket, item.object_name, str(destination))
        manifest.append({"object_key": item.object_name, "size": item.size, "etag": item.etag})
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print({"objects": len(manifest), "target": str(root), "bucket": settings.artifact_bucket})


if __name__ == "__main__":
    main(sys.argv[1])
