#!/usr/bin/env python3
"""Keep the local Docker development stack in sync without rebuilding images."""

from __future__ import annotations

import hashlib
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG_FILES = (ROOT / ".env", ROOT / "docker-compose.yml")
BACKEND = ROOT / "backend"
POLL_SECONDS = 1
IGNORED_DIRS = {"__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".cache", "storage"}


def file_digest(path: Path) -> str | None:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except FileNotFoundError:
        return None


def config_snapshot() -> tuple[str | None, ...]:
    return tuple(file_digest(path) for path in CONFIG_FILES)


def backend_snapshot() -> tuple[tuple[str, int, int], ...]:
    """Track source files mounted into both the API and the worker."""
    files = []
    for path in BACKEND.rglob("*"):
        if any(part in IGNORED_DIRS for part in path.relative_to(BACKEND).parts):
            continue
        if not path.is_file() or path.suffix not in {".py", ".json"}:
            continue
        if "tests" in path.relative_to(BACKEND).parts:
            continue
        try:
            stat = path.stat()
        except FileNotFoundError:
            continue
        files.append((str(path.relative_to(BACKEND)), stat.st_mtime_ns, stat.st_size))
    return tuple(sorted(files))


def run(*args: str) -> bool:
    command = ["docker", "compose", *args]
    print("Running:", " ".join(command), flush=True)
    return subprocess.run(command, cwd=ROOT, check=False).returncode == 0


def main() -> int:
    if not (ROOT / ".env").is_file():
        print("Create .env first (for example, copy .env.development.example).", file=sys.stderr)
        return 1
    if not run("up", "-d"):
        print("The development stack could not start.", file=sys.stderr)
        return 1

    config = config_snapshot()
    backend = backend_snapshot()
    print("Watching .env, Compose configuration, and backend source. Frontend and API source use their own live reload.", flush=True)
    try:
        while True:
            time.sleep(POLL_SECONDS)
            current_config = config_snapshot()
            current_backend = backend_snapshot()
            if current_config != config:
                # Compose detects changed service configuration and recreates only
                # affected containers. A plain restart would keep old env values.
                if run("up", "-d", "--no-build"):
                    config = current_config
                    backend = current_backend
                    print("Configuration applied to the running stack.", flush=True)
                else:
                    print("Configuration update failed; retrying after the next poll.", file=sys.stderr, flush=True)
            elif current_backend != backend:
                changed = {name for name, *_ in current_backend} ^ {name for name, *_ in backend}
                old = {name: (mtime, size) for name, mtime, size in backend}
                changed.update(name for name, mtime, size in current_backend if old.get(name) != (mtime, size))
                # Uvicorn reloads Python automatically, but JSON catalog/data
                # changes need an explicit API restart. The worker needs a restart
                # for any backend source change.
                services = ["worker"]
                if any(name.endswith(".json") for name in changed):
                    services.append("api")
                if run("restart", *services):
                    backend = current_backend
    except KeyboardInterrupt:
        print("Watcher stopped; containers are still running.", flush=True)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
