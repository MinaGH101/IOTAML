# Database Migration Guide

## Migration chain

The reconstruction preserves the deployed chain and adds one forward-only hardening migration:

```text
20260712_0001_reliable_run_queue
20260712_0002_artifact_storage_and_domains
20260716_0003_node_cache_and_workflow_versions
20260716_0004_reusable_workflow_components
20260724_0005_schema_convergence
20260731_0006_backend_reconstruction
```

Do not edit or reset previously applied revisions. Migration `20260731_0006` preserves table names and primary keys, adds users/attempt/event/quota structures, adds ownership and recovery fields/indexes, and adds PostgreSQL foreign keys only after checking for orphan references.

## 1. Stop write traffic

Stop API and worker services before the backup and migration. Do not delete the old backend or database yet.

```bash
docker compose stop api worker
```

## 2. Create a pre-migration backup

From the replacement `backend/` directory:

```bash
cd backend
mkdir -p /backups
python scripts/pre_migration_backup.py /backups
```

Or use the combined shell wrapper when `pg_dump` is available:

```bash
./scripts/backup.sh /backups
```

The backup must contain a PostgreSQL custom-format dump, an object-storage manifest/copy, checksums and metadata. Verify the command exits successfully before continuing.

## 3. Check current revision

```bash
cd backend
alembic current
alembic history --verbose
```

Expected deployed predecessor is `20260724_0005`; an empty database may have no current revision.

## 4. Inspect orphan checks before production upgrade

Run against a staging copy first:

```bash
alembic upgrade head
```

On PostgreSQL, `0006` refuses to add restrictive foreign keys when an orphan is detected. The error identifies the source table/column and count. Preserve the orphan row, repair its reference deliberately, then rerun. The migration does not silently delete user data.

## 5. Upgrade

```bash
alembic upgrade head
```

Running the same command again is safe and should report the database at head:

```bash
alembic upgrade head
alembic current
```

Expected head:

```text
20260731_0006 (head)
```

## 6. Verify preserved data

Record counts before and after migration for at least:

```sql
SELECT COUNT(*) FROM projects;
SELECT COUNT(*) FROM datasets;
SELECT COUNT(*) FROM workflows;
SELECT COUNT(*) FROM workflow_versions;
SELECT COUNT(*) FROM runs;
SELECT COUNT(*) FROM artifacts;
SELECT COUNT(*) FROM workflow_components;
SELECT COUNT(*) FROM custom_nodes;
```

After migration, also verify:

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM run_attempts;
SELECT COUNT(*) FROM run_events;
SELECT COUNT(*) FROM artifact_quota_reservations;
```

Start the API once so legacy users are imported into `users`, then verify login, project/dataset/workflow lists, a stored workflow load, an artifact download and a representative run.

## 7. Start services

```bash
docker compose up -d postgres redis minio api worker
```

Verify:

```bash
curl -f http://localhost:8001/health/live
curl -f http://localhost:8001/health/ready
```

Use the port mapped by your Compose file when it differs from `8001`.

## Recovery from a failed migration

1. Leave API/worker stopped.
2. Read the exact Alembic error; correct environment/connectivity issues and rerun when no destructive statement occurred.
3. When the failure reports orphan references, repair those rows explicitly in a staging-reviewed SQL transaction, then rerun.
4. When schema state is uncertain, restore the pre-migration backup instead of manually stamping Alembic.

Restore command:

```bash
cd backend
./scripts/restore.sh /backups/<backup-directory>
```

`restore.sh` restores PostgreSQL and then verifies/restores object checksums through the canonical storage backend.

## Rollback policy

`0006` intentionally has a non-destructive downgrade. Automatically dropping users, run-attempt history, ownership fields or quota reservations would lose data. Operational rollback is therefore:

1. Stop services.
2. Deploy the previous backend image/folder.
3. Restore the matched pre-migration PostgreSQL and object-storage backup.
4. Verify the previous Alembic revision and row counts.
5. Restart services.

Never use `alembic stamp` to hide a partially applied migration.

## Migration tests included

The test suite covers:

- Empty database to head.
- Representative legacy schema/data through `0005` to head.
- Row preservation.
- Metadata convergence.
- Repeated `upgrade head`.
- No unexpected table drops.
