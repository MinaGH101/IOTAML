# Backend Reconstruction Report

## Scope

This backend was reconstructed from the complete IOTA ML repository as a direct replacement for the original `backend/` directory. The primary goals were data preservation, React frontend compatibility, deterministic workflow execution, recoverable operations and removal of parallel legacy implementations.

## Original architecture and findings

The original backend had working functionality but overlapping ownership:

- Route handlers existed under both legacy `app/api/` and newer domain packages.
- ORM models were split between `app/models.py` and domain model modules.
- Database setup existed in both `app/database.py` and `app/core/database.py`.
- Storage existed under both `app/storage/` and `app/infrastructure/storage/`.
- Workflow execution existed in `app/services/workflow_executor.py` and `app/workflow/executor.py`.
- A large generated Python node catalog duplicated executable metadata.
- MinIO/OpenAI imports were eager enough that baseline test collection could fail when optional packages/services were absent.
- Ownership, pagination, preview bounds, artifact state recovery and worker attempt history were inconsistent across domains.

## Public API inventory

The frontend uses the existing `/api` routes for authentication, projects, datasets, workflows/versions/autosave/validation, runs/progress/cancel/retry, node catalog/custom nodes, components/import/export/versioning, artifacts/download/cache, and assistant chat. Exact retained routes and envelopes are documented in `API_COMPATIBILITY.md`.

## Database inventory

Canonical metadata contains these tables:

```text
users
projects
datasets
workflows
workflow_versions
workflow_components
workflow_component_versions
runs
run_attempts
run_events
custom_nodes
artifacts
artifact_lineage
artifact_quota_reservations
node_cache_entries
node_executions
```

Existing table names and primary keys are preserved. Existing workflow graph JSON and artifact identifiers remain readable.

## Migration history

Existing revisions were retained unchanged:

```text
20260712_0001_reliable_run_queue
20260712_0002_artifact_storage_and_domains
20260716_0003_node_cache_and_workflow_versions
20260716_0004_reusable_workflow_components
20260724_0005_schema_convergence
```

New migration:

```text
20260731_0006_backend_reconstruction
```

`0006` adds canonical users, run attempts/events, artifact quota reservations, selected-node and failure metadata, ownership/ID-column fields, indexes, and orphan-checked PostgreSQL foreign keys. Its operational rollback is backup restore because dropping this recovery data would be destructive.

## Workflow formats and node inventory

Historical and current graphs are accepted by `app/workflow/compatibility/normalizer.py` and execute through one pipeline. The registry contains:

- 64 canonical registered node definitions.
- 57 historical aliases.
- One validated generated JSON catalog.

Every stored alias resolves before planning. Missing implementations fail explicitly instead of generating fabricated output.

## Architecture changes

### Removed parallel modules

```text
app/api/
app/models.py
app/database.py
app/storage/
app/services/workflow_executor.py
```

### Established canonical modules

- `app/core/config.py` and `app/core/database.py`.
- Domain-owned models/schemas/repositories/services/routes.
- `app/infrastructure/storage/` for local/MinIO access.
- `app/infrastructure/queue/` for PostgreSQL queue state and Redis notifications.
- `app/workflow/` for normalization, validation, planning, execution and caching.
- `app/nodes/registry/` and reproducible catalog generation.
- `app/workers/` for reliable execution, child isolation, signals and maintenance.

## Database and API hardening

- One SQLAlchemy Base and Alembic metadata tree.
- Database-backed PBKDF2 authentication with one-time legacy-user import.
- Owner checks on projects, datasets, workflows, runs, artifacts, components and custom nodes.
- Deterministic bounded collection queries and table previews.
- Query projections/eager loading where nested records are required.
- Strict production CORS/secret validation.
- Redis-backed replaceable throttling with a bounded local fallback.
- Generated UUID object keys and validated display filenames/content.
- Request IDs, structured errors, JSON logging, separate health checks and metrics.

## Workflow and node changes

- One compatibility-normalized executor.
- Cycle/missing-node/edge/port/parameter/type validation before execution.
- Selected-node upstream closure.
- Multiple dataframe input and output-port support.
- Central dataframe/ID-column metadata contract.
- Cache keys include node/version/parameters/checksums/ports/ID/schema/component/execution mode.
- Custom Python blocked unless `ALLOW_CUSTOM_CODE=true`.

## Artifact and worker recovery

- Explicit artifact lifecycle and transactional quota reservations.
- Temporary upload, SHA-256 verification, immutable finalize and cleanup.
- Artifact/cache reconciliation and dry-run maintenance.
- Atomic PostgreSQL claims, attempts, heartbeat, retry classification and dead-letter state.
- Graceful worker signals and bounded child files/output.
- Redis outage cannot lose queued runs.

## Tests present

The delivered suite includes unit, contract, integration, migration, API/policy and recovery-focused tests. It covers:

- API/error envelopes.
- Domain architecture boundaries.
- Workflow validation, output-port selection and structured failures.
- Dataframe/ID-column behavior.
- Node registry/catalog contracts.
- Cache keys/runtime.
- Artifact lifecycle/storage failure handling.
- Components and workflow versions.
- Durable queue claim/retry/cancellation/recovery behavior.
- Custom-code policy and process restrictions.
- Empty/legacy migration paths and data preservation.

Final executed validation in the reconstruction environment:

```text
pytest -q                                      78 passed
python -m compileall -q app scripts            passed
python -m app.nodes.catalog.generate --check   passed
```

## Deployment validation status

The backend includes a non-root multi-stage Dockerfile and remains compatible with the repository's API/worker/migrate Compose service model. The final environment did not provide a running project PostgreSQL/Redis/MinIO Compose stack, so live container-to-container verification was not claimed. Database/storage/queue behavior is covered by the included automated tests and should still be validated against a staging copy of the user's actual Compose environment before production cutover.

## Known limitations

- Child-process controls for custom code are not a secure untrusted multi-tenant sandbox; custom code remains disabled by default.
- The workflow list retains graph data because the current frontend expects it; pagination and payload bounds mitigate this until the frontend adopts summary/detail loading.
- Redis coordination is intentionally best-effort; PostgreSQL polling is the fallback.
- `ruff` and `mypy` configuration and dependencies are included, but they must be run in the deployment/development environment where those packages are installed.
- Existing Pandas node behavior and current artifact formats are intentionally preserved; broad Polars/Parquet conversion is not part of this reconstruction.
- Kubernetes, Celery/ARQ and PgBouncer are future options, not dependencies.

## Replacement procedure

1. Back up PostgreSQL and object storage with the old system stopped for writes.
2. Keep the old backend folder as a rollback copy.
3. Delete/rename the old `backend/` and place this delivered `backend/` in the same repository location.
4. Copy production environment values into the new `.env`; provision a non-default `USER_FILE`.
5. Run `alembic upgrade head`.
6. Build/start API and worker services.
7. Verify liveness, readiness, login, project/dataset/workflow access, one workflow run, cancellation and artifact retrieval.
8. Retain the pre-migration backup until production verification is complete.
