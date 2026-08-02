"""Runtime directory initialization only.

Object and artifact operations belong to the canonical storage interface in
``app.infrastructure.storage``; this module only prepares writable directories
used by API/worker processes.
"""
from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from app.core.config import get_settings

settings = get_settings()


def ensure_dirs() -> None:
    root = Path(settings.storage_dir)
    for relative in ("datasets", "runs", "profile-images", "job-runtime", "objects"):
        (root / relative).mkdir(parents=True, exist_ok=True)


def ensure_storage_writable() -> None:
    """Fail startup early when the mounted runtime volume is not writable."""
    root = Path(settings.storage_dir)
    root.mkdir(parents=True, exist_ok=True)
    probe = root / f".iota-write-probe-{uuid4().hex}"
    try:
        probe.write_bytes(b"ok")
    except OSError as exc:
        raise RuntimeError(
            f"Runtime storage is not writable: {root}. "
            "Ensure the persistent volume exists and is owned by the container user."
        ) from exc
    finally:
        probe.unlink(missing_ok=True)
