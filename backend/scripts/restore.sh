#!/usr/bin/env sh
set -eu
SOURCE="${1:?Usage: restore.sh /backups/YYYYMMDD-HHMMSS}"
: "${DATABASE_URL:?DATABASE_URL is required}"
DB_URL_FOR_PG=$(printf '%s' "$DATABASE_URL" | sed 's#postgresql+psycopg2://#postgresql://#; s#postgresql+psycopg://#postgresql://#')
pg_restore --clean --if-exists --no-owner --dbname="$DB_URL_FOR_PG" "$SOURCE/postgres.dump"
python scripts/restore_artifacts.py "$SOURCE/artifacts"
printf '%s\n' "Restore completed from $SOURCE"
