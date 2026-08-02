"""Create the required PostgreSQL and object-storage backup before migration."""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.engine import make_url

from app.core.config import get_settings


def pg_dump_url() -> str:
    url = make_url(get_settings().database_url)
    driver = url.drivername.split("+", 1)[0]
    return str(url.set(drivername=driver))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", default=os.getenv("BACKUP_DIR", "/backups"))
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    target = Path(args.target).resolve() / stamp
    target.mkdir(parents=True, exist_ok=False)
    subprocess.run(["pg_dump", pg_dump_url(), "--format=custom", f"--file={target / 'postgres.dump'}"], check=True)
    subprocess.run([sys.executable, "scripts/backup_artifacts.py", str(target / "artifacts")], check=True)
    (target / "migration-head-before.txt").write_text(
        subprocess.check_output(["alembic", "current"], text=True), encoding="utf-8"
    )
    print(target)


if __name__ == "__main__":
    main()
