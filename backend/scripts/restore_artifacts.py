"""Restore object storage from a backup manifest using the canonical interface."""
from __future__ import annotations

import hashlib
import json
import mimetypes
import sys
from pathlib import Path

from app.infrastructure.storage import get_storage_backend


def main(source: str) -> None:
    root = Path(source).resolve()
    manifest_path = root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    backend = get_storage_backend()
    backend.ensure_ready()
    restored = 0
    for item in manifest:
        object_key = str(item["object_key"])
        path = (root / object_key).resolve()
        if root != path and root not in path.parents:
            raise RuntimeError(f"Unsafe object key in manifest: {object_key}")
        if not path.is_file():
            raise FileNotFoundError(path)
        hasher = hashlib.sha256()
        with path.open("rb") as source_file:
            while chunk := source_file.read(1024 * 1024):
                hasher.update(chunk)
        digest = hasher.hexdigest()
        if digest != item.get("checksum_sha256"):
            raise RuntimeError(f"Checksum mismatch for {object_key}")
        backend.put(path, object_key, mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        restored += 1
    print(json.dumps({"objects": restored, "source": str(root), "backend": backend.name}))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/restore_artifacts.py SOURCE_DIRECTORY")
    main(sys.argv[1])
