# Database migrations

Alembic is the only owner of persistent database schema. API and worker startup
must never call `create_all()` or execute schema-changing SQL.

## Fresh database

`20260712_0001` creates the complete base application schema. Revisions 0002
through 0004 add artifact storage, node cache/versioning, and reusable
components. `20260724_0005` validates and converges installations that were
previously maintained by startup-time compatibility DDL.

```bash
cd backend
DATABASE_URL=postgresql+psycopg2://... alembic upgrade head
```

The migration test suite also upgrades a temporary empty database and verifies
that all model tables are present at head.

## Existing installation

1. Stop API and worker containers and create a PostgreSQL plus object-storage
   backup using `scripts/backup.sh`.
2. Run the migration service once:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm migrate
   ```

3. Start the normal production stack only after migration succeeds.

The baseline revisions inspect existing tables before creating or adding
objects. The convergence revision adds only missing compatibility columns and
indexes; it does not drop tables, rewrite rows, or delete user data.

If the convergence migration reports a missing base table, stop and restore the
backup. Do not stamp the database to head and do not start the API against a
partial schema.

## Validation

```bash
cd backend
pytest -q tests/test_migrations.py
alembic current
alembic check
```
