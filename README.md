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

### Frontend feature boundaries

The React source is organized by capability under `src/auth`, `src/projects`,
and `src/workspace`. Each feature owns its pages, page-local UI, service
boundary, and domain logic. Feature-neutral UI, transport, types, and helpers
live in `src/shared`; `src/app` only composes the application.

The complete ownership rules and directory map are in
[`frontend/ARCHITECTURE.md`](frontend/ARCHITECTURE.md). Run
`npm run check:architecture` after adding or moving frontend source files.
Project and workflow navigation uses canonical browser URLs, so project detail
and workspace links can be refreshed or opened directly.

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

## Development

Copy the development template and start the hot-reload overrides:

```bash
cp .env.development.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Development exposes PostgreSQL, Redis, MinIO, API, and Vite on localhost. Source
mounts and filesystem polling exist only in `docker-compose.dev.yml`.

## Production

Copy `.env.example` to `.env`, replace every `CHANGE_ME` value, and configure
TLS/reverse-proxy routing for the selected hostname. Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Production serves the compiled frontend through Nginx, runs FastAPI without
reload, has no source mounts or polling, and exposes only the frontend port.
PostgreSQL, Redis, MinIO, API, and worker remain on the Compose network.

In both modes the one-shot migration service must complete `alembic upgrade
head` before API and worker startup. A separate one-shot `storage-init` service
repairs ownership of the persistent runtime volume for the non-root API and
worker, including volumes created by older releases.

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
python -m compileall -q app tests
```

Frontend:

```bash
cd frontend
npm ci
npm test
npm run check
```

Compose and release validation:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet
./scripts/scan-secrets.sh
./scripts/package-release.sh ../iota_ml-clean.zip
```

Database migration design and recovery procedures are documented in
[`docs/DATABASE_MIGRATIONS.md`](docs/DATABASE_MIGRATIONS.md).

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

## Analysis boards and responsive execution

- Workflow connections are animated while the workflow canvas is visible.
- Workflow and Analysis Board dot grids are rendered on fixed canvas layers, so they do not move during pan.
- Analysis Board supports named tabs. Only the active tab mounts its result cards.
- The right results panel can target any board tab. Pins made from Workflow or a node modal always go to the main board.
- Board pan, zoom, card drag, and resize use `requestAnimationFrame` and direct transforms instead of React state on every pointer event.
- The worker preloads the scientific runtime and uses a warm Linux fork for each isolated run, with the previous subprocess path as a fallback.
- Redis wakes idle workers immediately; PostgreSQL queue polling is throttled while idle, and active process monitoring remains fast.
- Set `JOB_USE_FORK_FAST_PATH=false` to disable warm-fork execution when debugging or on an incompatible host.

## Node cache, lineage, autosave, and versions

- Persisted project workflows use deterministic node-output caching backed by internal artifacts.
- Cache keys include node implementation version, normalized parameters, upstream artifact digests, relevant dataset fingerprints, task type, and target column.
- Cache artifacts are checksum-verified in both the parent worker and isolated child before deserialization.
- Each node run records execution status, duration, cache hit/source run, output artifact, and lineage.
- The canvas shows queued, running, cached, succeeded, and failed states on the corresponding node.
- Workflow editing uses a 900 ms debounced, serialized, optimistic-concurrency autosave. Unchanged drafts produce no database write.
- Explicit Save creates an immutable named version. Versions can be previewed, restored, or deleted from the right panel.
- Only successful workflow results are attached to a draft/version; inspecting historical runs does not alter saved results.

Detailed design and operations: [`docs/ARTIFACT_CACHE_AND_VERSIONING.md`](docs/ARTIFACT_CACHE_AND_VERSIONING.md)

## Reusable workflow components

- Multiple connected nodes can be grouped and replaced by one reusable typed component node.
- Components have private, project, or organization visibility and appear in the node palette and right-panel library.
- Public input/output ports are detected from boundary connections and can be renamed, typed, reordered, hidden, or marked optional.
- Internal settings remain private unless explicitly exposed as component parameters.
- Component versions are immutable and semantic-versioned. Existing workflow instances stay pinned until explicitly upgraded.
- Nested components execute with namespaced progress states and use the artifact cache at internal-node granularity.
- Import/export packages include nested dependencies and remap them transactionally.
- Usage tracking prevents destructive deletion of components or versions referenced by workflows or other components.
- Workflow and component version naming use styled in-app dialogs rather than browser prompts.

Detailed usage and API behavior: [`docs/REUSABLE_COMPONENTS.md`](docs/REUSABLE_COMPONENTS.md)
