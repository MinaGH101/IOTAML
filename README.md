# IOTA ML

A Docker-based no-code machine-learning workflow platform with React, FastAPI,
PostgreSQL, Redis workers, and MinIO-compatible artifact storage.

## Architecture

```text
frontend/                    React workflow and project UI
backend/app/core/            config, database, response/error contract
backend/app/domains/         business domains and API boundaries
backend/app/infrastructure/  storage and external adapters
backend/app/workers/         reliable isolated workflow execution
postgres                     metadata, workflows, runs, artifacts
redis                        worker wake-up and health signals
minio                        datasets, models, reports, plots, outputs
```

### Domain boundaries

The API is registered directly from `backend/app/domains`. Projects, workflows,
datasets, and artifacts use route/service/repository layers. Legacy
`backend/app/api/routes_*.py` modules only re-export domain routers so existing
imports do not break.

### Central API contract

Successful `/api` responses use:

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "request_id": "..."
}
```

Errors use:

```json
{
  "success": false,
  "error": {
    "code": "ARTIFACT_NOT_FOUND",
    "message": "Artifact not found.",
    "details": {}
  },
  "request_id": "..."
}
```

The frontend unwraps this contract centrally and maps stable error codes to
user-facing Persian messages.

## Artifact storage

New datasets and generated run files are stored through the artifact domain.
PostgreSQL stores metadata; MinIO stores object bytes.

Implemented controls:

- SHA-256 checksums and UUID object keys
- user/project ownership metadata
- file-size and CSV type validation
- user and project quotas
- artifact types and versions
- signed MinIO download URLs
- local-storage backend for tests
- retention and hourly cleanup of expired run outputs
- protection against deleting referenced datasets or active-run artifacts
- storage usage shown in the project UI
- MinIO health included in `/health/ready`

MinIO console: `http://localhost:9001`

## Run locally

Copy the environment template, set secure secrets, then build:

```bash
cp .env.example .env
docker compose down
docker compose up --build
```

The migration container runs `alembic upgrade head` before the API starts.

For an existing installation with legacy local dataset files:

```bash
docker compose exec api python scripts/migrate_legacy_artifacts.py
```

## Validation

Backend:

```bash
cd backend
pytest -q
alembic upgrade head
```

Frontend:

```bash
cd frontend
npm ci
npm run check
```

## Backups

Inside the backend container or another environment with PostgreSQL client
utilities:

```bash
BACKUP_DIR=/backups ./scripts/backup.sh
./scripts/restore.sh /backups/YYYYMMDD-HHMMSS
```

Backups include a PostgreSQL custom-format dump and all objects in the artifact
bucket.

## Theme

All frontend colors and visual tokens are centralized in:

```text
frontend/src/styles/theme.css
```

Run `npm run check:theme` after theme changes.
