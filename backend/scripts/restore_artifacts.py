from __future__ import annotations

import mimetypes
import sys
from pathlib import Path

from app.infrastructure.storage.minio_backend import MinioStorageBackend


def main(source: str) -> None:
    root = Path(source)
    backend = MinioStorageBackend()
    backend.ensure_ready()
    restored = 0
    for path in root.rglob("*"):
        if not path.is_file() or path.name == "manifest.json":
            continue
        object_key = path.relative_to(root).as_posix()
        backend.client.fput_object(
            backend.bucket,
            object_key,
            str(path),
            content_type=mimetypes.guess_type(path.name)[0] or "application/octet-stream",
        )
        restored += 1
    print({"objects": restored, "source": str(root), "bucket": backend.bucket})


if __name__ == "__main__":
    main(sys.argv[1])
