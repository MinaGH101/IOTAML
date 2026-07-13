#!/usr/bin/env sh
set -eu
SOURCE="${1:?Usage: restore.sh /backups/YYYYMMDD-HHMMSS}"
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$SOURCE/postgres.dump"
python scripts/restore_artifacts.py "$SOURCE/artifacts"
printf '%s\n' "Restore completed from $SOURCE"
