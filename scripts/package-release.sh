#!/usr/bin/env sh
set -eu

root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
output="${1:-$(dirname "$root")/iota_ml-clean.zip}"
case "$output" in
  /*) ;;
  *) output="$(pwd)/$output" ;;
esac

cd "$root"
"$root/scripts/scan-secrets.sh"
rm -f "$output"

find . -type f | while IFS= read -r path; do
  case "$path" in
    ./.env.example|./.env.development.example) echo "$path" ;;
    */.git/*|*/node_modules/*|*/dist/*|*/build/*|*/.venv/*|*/venv/*|*/__pycache__/*|*/.pytest_cache/*|*/.mypy_cache/*|*/.ruff_cache/*|*/.cache/*|*/coverage/*|*/htmlcov/*) ;;
    ./storage/*|./backend/storage/*|*/.DS_Store|*/.coverage|*.pyc|*.pyo|*.log|*.db|*.sqlite|*.sqlite3|*.dump|*.sql.gz|*.zip) ;;
    */.env|*/.env.*) ;;
    *) echo "$path" ;;
  esac
done | zip -q "$output" -@

archive_files="$(unzip -Z1 "$output")"
if echo "$archive_files" | grep -Eq '(^|/)\.git/|(^|/)\.env$|(^|/)node_modules/|(^|/)__pycache__/|(^|/)\.pytest_cache/|(^|/)\.DS_Store$|\.py[co]$|^storage/|^backend/storage/'; then
  echo "Release validation failed: excluded content is present."
  exit 1
fi

echo "$output"
