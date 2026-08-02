#!/usr/bin/env sh
set -eu
python scripts/pre_migration_backup.py --target "${BACKUP_DIR:-/backups}"
