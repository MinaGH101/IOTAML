# Backend domain boundaries

Each domain owns its HTTP routes and coordinates its own schemas, repository,
and service layer.

```text
app/domains/
  artifacts/   # metadata, quotas, signed downloads, retention
  datasets/    # CSV ingestion and previews backed by artifacts
  projects/    # project lifecycle and counters
  workflows/   # validation and persistence
  runs/        # reliable queued execution API
  nodes/       # built-in and custom-node catalog API
  auth/        # current authentication boundary
```

Rules:

- Routes validate transport input and call domain services.
- Services own business rules and transactions.
- Repositories own database queries.
- Cross-domain storage uses the artifact service, never raw filesystem paths.
- `app/api/routes_*.py` are compatibility re-exports only.
- `app/models.py` and `app/schemas.py` remain compatibility modules while
  existing migrations and node code are moved incrementally.
