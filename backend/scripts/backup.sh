#!/usr/bin/env sh
set -eu
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR:-/backups}/$STAMP"
mkdir -p "$TARGET"
pg_dump "$DATABASE_URL" --format=custom --file="$TARGET/postgres.dump"
python scripts/backup_artifacts.py "$TARGET/artifacts"
printf '%s\n' "Backup created at $TARGET"
