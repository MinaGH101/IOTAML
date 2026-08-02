"""Stream a canonical storage-backend backup with a JSON manifest."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from app.infrastructure.storage import get_storage_backend


def main(target: str) -> None:
    root = Path(target).resolve()
    root.mkdir(parents=True, exist_ok=True)
    backend = get_storage_backend()
    backend.ensure_ready()
    manifest: list[dict[str, object]] = []
    for object_key in backend.iter_keys():
        destination = (root / object_key).resolve()
        if root != destination and root not in destination.parents:
            raise RuntimeError(f"Unsafe object key returned by storage backend: {object_key}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256()
        size = 0
        with backend.reader(object_key) as source, destination.open("wb") as output:
            while chunk := source.read(1024 * 1024):
                output.write(chunk)
                digest.update(chunk)
                size += len(chunk)
        manifest.append({"object_key": object_key, "size_bytes": size, "checksum_sha256": digest.hexdigest()})
    (root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"objects": len(manifest), "target": str(root), "backend": backend.name}))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/backup_artifacts.py TARGET_DIRECTORY")
    main(sys.argv[1])
