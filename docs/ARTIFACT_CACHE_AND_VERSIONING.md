# Artifact Cache, Lineage, Autosave, and Workflow Versions

## Execution model

Every persisted project workflow can reuse deterministic node outputs from earlier successful runs. The worker still creates a new `Run` and `NodeExecution` record for auditability, but it can skip a node when the node's full cache key resolves to a verified cache artifact.

Cache lookup is intentionally disabled for runs that are not attached to both a persisted workflow and a project. This prevents ambiguous cache ownership and keeps cache isolation scoped to `(owner, project)`.

## Cache key contract

The full SHA-256 cache key includes:

- cache format version
- canonical node type and node implementation/cache version
- normalized node settings and resolved dynamic parameters
- pinned input configuration
- hashes of upstream node output artifacts
- source/target port handles
- fingerprints of directly referenced datasets
- target column and task type

Changing any relevant input produces a different key. Unrelated datasets and unrelated workflow branches are excluded, so they do not invalidate otherwise reusable work.

## Cacheable and non-cacheable nodes

Nodes are cacheable by default only when their registered implementation is available. The following are explicitly non-cacheable:

- manual trigger nodes
- Python code nodes
- custom Python nodes
- export/report nodes that create side effects

A future node with time-based, external API, random, or mutable behavior must either set `cacheable = False` or include a fixed seed and all external state in its version/input fingerprint.

## Artifact format and trust boundary

Cached node values are serialized as compressed internal Joblib artifacts. They are never accepted through the public artifact upload API as cache entries.

Before deserialization:

1. The parent worker checks ownership and cache-entry status.
2. The artifact is materialized from MinIO/local storage.
3. Its SHA-256 checksum is verified.
4. Only the verified local path is passed to the isolated child process.
5. The child verifies the checksum again before loading.

A tampered or missing file is treated as a cache miss and the node executes normally.

## Artifact metadata and lineage

PostgreSQL stores artifact metadata while MinIO stores bytes. Cache artifacts record:

- owner, project, workflow, run, and node
- logical name and content type
- size and SHA-256 checksum
- cache key, node type, and node version
- output digest and source run
- creation, access, and expiration times

`artifact_lineage` records parent-to-child artifact edges, including input name and source/target node IDs. Lineage endpoints enforce artifact ownership on both ends of each returned edge.

## Node execution records

Each run/node pair has one `NodeExecution` record containing:

- queued/running/cached/succeeded/failed status
- cache hit and cache key
- output artifact and digest
- source run for a cache hit
- start/finish timestamps and duration
- error and parent-node metadata

The workflow canvas receives live node status snapshots while a run is active. Cached nodes are shown separately from executed nodes.

## Partial reruns

Partial reruns use the existing connected-graph execution mode. Cache keys allow unchanged upstream and branch-local nodes to be reused. A changed node parameter invalidates that node and naturally invalidates downstream nodes through the changed output digest, while unaffected branches remain reusable.

## Retention and eviction

The worker runs cache cleanup periodically:

- expired unpinned entries are removed in bounded batches
- project cache size is capped with least-recently-used eviction
- pinned entries are protected
- cache entries track last access and hit count

Configuration:

```env
NODE_CACHE_ENABLED=true
NODE_CACHE_RETENTION_DAYS=30
NODE_CACHE_CANDIDATES_PER_FINGERPRINT=8
NODE_CACHE_MAX_BYTES_PER_PROJECT=3221225472
NODE_CACHE_COMPRESSION=3
NODE_CACHE_CLEANUP_BATCH_SIZE=200
```

Administrative/user APIs:

- `GET /api/artifacts/cache/stats?project_id=...`
- `DELETE /api/artifacts/cache?project_id=...`
- `GET /api/artifacts/{artifact_id}/lineage`
- `GET /api/runs/{run_id}/node-executions`

## Autosave design

The editor keeps one mutable current draft per workflow. Autosave:

- waits 900 ms after the latest editor change
- serializes concurrent writes through one client-side queue
- sends a base revision for optimistic concurrency control
- calculates a canonical graph hash on the server
- performs no database write when name, graph, project, and attached result are unchanged
- increments the workflow revision only for a real change
- reports conflicts instead of overwriting a newer session

The graph includes node positions, edges, node settings, dataset/task settings, Analysis Board tabs, board items, and active board selection.

A historical run opened for inspection does not become the workflow's saved result. Only the last successful workflow run is attached to the current draft.

## Named workflow versions

The Save icon creates an immutable, user-named version after ensuring the current draft is autosaved. A version stores:

- immutable graph snapshot and hash
- source draft revision
- version number, name, description, author, and timestamp
- optional last successful run/result

The Versions tab in the right panel supports:

- list and refresh
- read-only preview in the workspace
- return to the current autosaved draft
- restore a version as a new current draft revision
- delete a named version

Version numbers are allocated while locking the workflow row, preventing duplicate numbers during concurrent saves. The configurable limit prevents unbounded metadata growth:

```env
WORKFLOW_VERSION_LIMIT=100
```

## Database migration

The migration is:

```text
backend/alembic/versions/20260716_0003_node_cache_and_workflow_versions.py
```

Apply it with:

```bash
cd backend
alembic upgrade head
```

For Docker deployments, the `migrate` service applies it before the API and worker start.

## Validation

```bash
cd backend
pytest -q

cd ../frontend
npm ci
npm run check
```

The cache tests cover deterministic keys, invalidation, verified round trips, and tamper rejection. Workflow tests cover no-op autosaves, revision increments, immutable named snapshots, and restoration.
