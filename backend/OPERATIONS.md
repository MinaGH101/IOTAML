# Backend Operations

## Required environment

Copy `.env.example` to `.env` and replace every production secret. Production startup rejects a short/default auth secret, wildcard CORS, and development MinIO credentials.

Minimum production settings:

```text
APP_ENVIRONMENT=production
AUTH_SECRET=<at least 32 random characters>
CORS_ORIGINS=https://your-frontend.example
DATABASE_URL=postgresql+psycopg2://...
STORAGE_BACKEND=minio
MINIO_ENDPOINT=...
MINIO_PUBLIC_ENDPOINT=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
USER_FILE=/run/secrets/iota-users.json
ALLOW_CUSTOM_CODE=false
```

Provision `USER_FILE` with one or more users and no `development_default` marker. Generate a password hash interactively:

```bash
cd backend
python scripts/hash_password.py
```

Example user entry:

```json
{
  "users": [
    {
      "username": "operator",
      "password_hash": "pbkdf2_sha256$...",
      "first_name": "IOTA",
      "last_name": "Operator",
      "email": "operator@example.com",
      "access_level": "Admin"
    }
  ]
}
```

The JSON file is imported only when the `users` table is empty. Afterwards, PostgreSQL is authoritative.

## Development startup

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

In another terminal:

```bash
cd backend
. .venv/bin/activate
python worker.py
```

The bundled development user is `admin` / `admin123`; production bootstrap explicitly rejects it.

## Validation commands

```bash
cd backend
python -m compileall app scripts
pytest
alembic upgrade head
python -m app.nodes.catalog.generate --check
ruff check app tests scripts
mypy app
```

## Docker/Compose startup

The Docker image is multi-stage and runs as non-root UID/GID `10001`. `/app/storage` is the writable runtime path.

```bash
docker compose build api worker
docker compose run --rm migrate
docker compose up -d postgres redis minio api worker
```

The API container command serves port `8000`; use the host mapping from the project Compose file.

## Health and metrics

```text
GET /health/live   process liveness only
GET /health/ready  PostgreSQL + storage, and Redis when configured required
GET /health        legacy compatibility health
GET /metrics       Prometheus text when enabled
```

Readiness checks are bounded and do not scan the run queue.

## Worker scaling

Run one or more `python worker.py` processes. PostgreSQL row locking with `SKIP LOCKED` prevents duplicate claims. Redis only accelerates wake-up; polling continues when Redis is unavailable.

Size PostgreSQL for the maximum possible pool usage:

```text
API process count x (DATABASE_POOL_SIZE + DATABASE_MAX_OVERFLOW)
+ worker replica count x (DATABASE_POOL_SIZE + DATABASE_MAX_OVERFLOW)
+ migration/maintenance/admin reserve
```

With two API processes, one worker, pool size 5 and overflow 5, reserve at least 40 PostgreSQL connections. Reduce per-process pools before increasing replicas. Run children do not initialize general application pools. PgBouncer can be introduced later for larger deployments.

## Run recovery

Dry-run report:

```bash
python -m app.workers.maintenance stale-runs --dry-run
```

Recover stale runs:

```bash
python -m app.workers.maintenance stale-runs
```

List dead-lettered work:

```bash
python -m app.workers.maintenance dead-letter
```

Cancellation is idempotent. On shutdown, workers stop claiming, signal active children, wait `JOB_SHUTDOWN_GRACE_SECONDS`, then leave unfinished work recoverable.

## Artifact and cache maintenance

```bash
python -m app.workers.maintenance artifacts --dry-run
python -m app.workers.maintenance artifacts --verify-checksums
python -m app.workers.maintenance cache --dry-run
python -m app.workers.maintenance usage
python -m app.workers.maintenance all --dry-run
```

Use dry-run first. PostgreSQL advisory locks prevent overlapping destructive jobs. Reconciliation is paginated and does not load the complete bucket into memory.

## Backup and restore

Backup before every migration/release:

```bash
./scripts/backup.sh /backups
```

Restore matched database and object storage:

```bash
./scripts/restore.sh /backups/<backup-directory>
```

Retain database and object backups together because artifact metadata and object keys are a consistency pair.

## Logs

Logs are JSON by default on stdout/stderr. Centralize container logs with your existing collector. Context includes request/run/workflow/node/worker/artifact IDs when available. Dataset values, credentials and subprocess secret environments are not logged. Field and child-output limits are controlled through `.env`.

Run-event/log cleanup:

```bash
python -m app.workers.maintenance logs --dry-run
python -m app.workers.maintenance logs
python -m app.workers.maintenance runtime --dry-run
python -m app.workers.maintenance runtime
```

## Security notes

- Keep `ALLOW_CUSTOM_CODE=false` for production unless every user is trusted.
- The optional child-process restrictions are not a secure untrusted multi-tenant sandbox.
- Mount `USER_FILE` and `.env` as secrets; do not bake them into the image.
- Run the container with a read-only root filesystem where Compose permits and mount only `/app/storage` or a dedicated runtime directory writable.
- Never expose MinIO administrative credentials to browser clients or run-child environments.
- Keep `CORS_ORIGINS` as an exact comma-separated allowlist.
- Terminate TLS at the reverse proxy and forward trusted proxy headers only.
