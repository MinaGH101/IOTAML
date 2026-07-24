# IOTA ML coordinated refactor report

## Root causes and architectural changes

### Dataframes, IDs, and caching

- Replaced the copied active/source dataframe pair with `DataFramePayload`,
  shared immutable `DataFrameLineage`, and explicit source row-position keys.
- The active frame contains the ID first and calculation columns only. Source
  column names remain available to ID selectors without reintroducing hidden
  columns into calculations.
- Dataset-backed lineage is now an artifact/file reference. The full source
  frame is dropped during cache serialization and loaded lazily only when a
  downstream ID switch needs an original column. Synthetic frames retain an
  in-memory fallback.
- Contract inheritance aligns rows by unique ID, then by a preserved index; it
  no longer guesses from equal lengths. Aggregations and joins explicitly reset
  lineage.
- Contract normalization is idempotent and runs at one executor boundary,
  recursively covering `outputs_by_port`. The cache format is now
  `iota-node-cache-v3`.
- Nodes use a copied mutable input only when they mutate data. Preview/export
  paths consume the public active frame.

Primary files: `backend/app/nodes/types.py`, `backend/app/nodes/io.py`,
`backend/app/workflow/executor.py`,
`backend/app/services/node_cache_keys.py`,
`backend/app/nodes/cleaning/select_columns_node.py`, and the affected
transformation, inspection, visualization, and export nodes.

### Database migrations

- Alembic is the only schema mutation path. API startup no longer calls
  `create_all()` or issues compatibility `ALTER TABLE` statements.
- Revision `20260712_0001` is a real empty-database baseline and also upgrades
  the known pre-Alembic tables without replacing or truncating them.
- Revision `20260724_0005` explicitly converges installations previously
  maintained by startup DDL and adds missing ORM indexes.
- The one-shot migration service must finish successfully before API and worker
  startup.

Primary files: `backend/alembic/versions/20260712_0001_reliable_run_queue.py`,
`backend/alembic/versions/20260724_0005_schema_convergence.py`,
`backend/app/main.py`, `backend/app/models.py`, and
`docs/DATABASE_MIGRATIONS.md`.

### Development and production containers

- `docker-compose.yml` contains shared pinned services and migration ordering.
- `docker-compose.dev.yml` alone enables source mounts, Vite, polling, exposed
  development ports, and FastAPI reload.
- `docker-compose.prod.yml` requires production secrets, exposes only Nginx,
  and adds resource, process, restart, logging, health, and network controls.
- The frontend production image is a compiled Vite build served by pinned
  Nginx; the backend image is multi-stage and non-root.
- A one-shot `storage-init` service owns the runtime volume for UID/GID 10001
  before the non-root API and worker start. API startup and readiness also
  verify that runtime storage is writable.
- API and public storage endpoints are environment-driven. Production settings
  reject weak authentication and object-storage credentials.

### Frontend feature ownership and rerenders

- Reorganized the React source around `auth`, `projects`, `workspace`, `shared`,
  and `app` instead of flat `pages`, `components`, `features`, and `api` files.
- Each capability now owns its pages, API service, feature components, hooks,
  and model. Workflow-only shell panels and login-only visuals are colocated
  with their pages.
- Replaced transient screen-state navigation with canonical, typed browser
  routes for login, profile, project list, project creation, project detail,
  and workflow deep links. Direct refresh now reloads the referenced project.
- Split project management from project detail and decomposed Analysis Board
  into output selectors, cards, controls, viewport lifecycle, and pointer
  interaction modules.
- Workflow selection/deletion, graph-derived column context, analysis boards,
  run polling/history, dataset operations, custom-node lifecycle, component
  boundary analysis, node mutations, and autosave signatures now have explicit
  hook/model owners.
- Board rename and delete dialog actions remain page-level UI orchestration and
  delegate mutations to the analysis-board hook, including main-board and
  read-only preview guards.
- Reduced `WorkflowPage.tsx` from 1,495 lines to 447 lines. The route now
  coordinates the header, workspace stage, overlays, and capability
  controllers instead of implementing their business rules.
- Split workflow bootstrap/document coordination, autosave persistence,
  workflow versions, execution, canvas actions, and automatic layout into
  separate hooks/models.
- Split reusable-component behavior into editor, library/version management,
  overlay, and pure graph-transformation modules. Group, ungroup, and upgrade
  transformations now have regression tests.
- Added architecture limits that reject route pages over 500 lines and
  workflow hooks over 450 lines, preventing the former god-component structure
  from silently returning.
- Fixed the automatic-layout runtime path, which previously referenced
  undefined `panelGap` and `panelTopOffset` variables.
- Split the shared API contract into auth, project, dataset, artifact, catalog,
  workflow/component, run, and custom-node domains while preserving the
  existing barrel import boundary.
- Split the monolithic frontend API client into transport, authentication,
  project/dataset, and workspace service boundaries.
- Added an executable architecture contract that validates required folders,
  retired legacy paths, every relative import, cross-feature dependencies, and
  workspace model independence.
- Extracted indexed/memoized graph column context, runtime result selection,
  parameter column modeling, workflow layout, and view/panel state.
- Inspector and NodeModal continue through the same `ParamEditor` model.
- Expensive graph-derived column traversal is memoized per graph snapshot.
- Right-panel callbacks and layout objects are stable. Inactive right-panel
  tabs, Workflow, and Analysis Board views are unmounted instead of hidden.
- Panel state is isolated in a reducer; regression coverage verifies view
  transitions do not change workflow graph data.

Primary files: `frontend/ARCHITECTURE.md`,
`frontend/scripts/check-feature-boundaries.mjs`,
`frontend/src/workspace/_model`, `frontend/src/workspace/_hooks`,
`frontend/src/workspace/pages/workflow`,
`frontend/src/workspace/pages/board`, and the feature `_service` directories.

### Security and release hygiene

- Removed the supplied `.env`; only safe templates remain.
- `.gitignore` and Docker ignore files exclude local secrets and generated
  state.
- Added current-tree and Git-history secret scanning.
- Added deterministic release packaging that excludes Git metadata, secrets,
  dependencies, virtual environments, caches, build output, runtime storage,
  databases, archives, and OS metadata.
- Runtime `backend/storage` is excluded without excluding the source packages
  at `backend/app/storage` and `backend/app/infrastructure/storage`.

## Compatibility and data risk

- Existing database rows are preserved: migrations add missing structures and
  do not rebuild populated legacy tables.
- Ambiguous dataframe row transformations no longer inherit source lineage.
  Custom nodes that aggregate or create new rows must declare
  `reset_lineage=True`; custom filters/sorts should preserve the ID or explicit
  row keys.
- Old node-cache entries are invalidated by the format version change.
- Dataset-backed cached results require their durable materialized dataset
  artifact to remain available, matching the existing cache/artifact lifecycle.

## Measurements

On a 100,000-row dataframe with twelve source feature columns:

- 1,000 shared payload copies: **33.81 ms**.
- Artifact-backed active-frame cache: **303,168 bytes**.
- Former active-frame plus embedded-source cache shape: **2,265,245 bytes**.
- Measured cache-size reduction: **86.6%**.

## Validation performed

Passed:

- `python -m compileall -q app tests alembic`
- Dataframe propagation, filtering/sorting, lazy cache-lineage, and downstream
  ID-switch smoke checks
- `npm run check:architecture`: all feature boundaries and relative imports
  passed
- `npm test`: 11 test files passed, 0 failed
- `npm run check:theme`: 115 source files, 10 CSS files, and 0 contract errors
- YAML parsing for all three Compose files and production policy assertions
- `git diff --check`
- `./scripts/scan-secrets.sh`, including available Git history

Environment-limited checks:

- Full `pytest`, Alembic fresh/legacy execution, worker, and persisted cache
  suites could not run because this workspace lacks pytest, SQLAlchemy,
  Alembic, and the backend dependency environment.
- `npm ci` reached the configured package source, but the managed workspace
  materialized empty package directories with no binaries or package files.
  TypeScript checking, Stylelint, CSS-debt checking, and the production build
  therefore could not start (`tsc: not found`). `postcss` is declared directly.
- Docker Compose CLI validation and image builds could not run because Docker
  is unavailable. The YAML and production invariants were validated directly.

Run the commands in the README in a networked development/CI environment before
deployment. These limitations are validation gaps, not claimed passes.

## Required secret response

The OpenAI API key found in the uploaded archive must be rotated. Removing it
from this deliverable and scanning the repository does not revoke the exposed
credential.
