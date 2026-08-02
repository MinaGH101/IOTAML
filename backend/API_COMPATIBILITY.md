# Frontend API Compatibility

## Compatibility policy

The reconstructed backend preserves the React frontend's route paths, bearer authentication, request fields, response envelope, workflow graph fields, status strings, node-catalog format and artifact URL behavior. Internal models are adapted at the route/schema boundary rather than requiring a frontend rewrite.

All application routes are mounted under `/api`. Collection endpoints accept bounded `limit`/`offset` parameters while retaining existing defaults so current callers continue to work.

## Response envelope

Successful non-streaming responses:

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "request_id": "request-id"
}
```

Errors:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": {}
  },
  "request_id": "request-id"
}
```

The backend accepts `X-Request-ID` and returns it in both the header and envelope. Artifact file bodies and signed redirects are not wrapped.

## Authentication

| Method | Route | Compatibility behavior |
|---|---|---|
| POST | `/api/auth/login` | Existing username/password payload and bearer token response retained |
| GET | `/api/auth/me` | Existing profile fields retained |
| PUT | `/api/auth/profile` | Existing editable profile fields retained |
| POST | `/api/auth/profile-image` | Existing multipart upload retained; path and content are now validated |

Legacy JSON users are imported once into the canonical `users` table. Existing plaintext entries are accepted during migration and stored as PBKDF2 hashes. Tokens are still signed bearer tokens, but the subject is resolved against the database on every authenticated request.

## Projects and datasets

| Method | Route |
|---|---|
| GET/POST | `/api/projects` |
| GET/PUT/DELETE | `/api/projects/{project_id}` |
| GET | `/api/datasets` |
| POST | `/api/datasets/upload` |
| GET | `/api/datasets/{dataset_id}/preview` |
| DELETE | `/api/datasets/{dataset_id}` |

Project and dataset response aliases are preserved. Lists now use deterministic ordering and bounds. Dataset previews are limited by configured rows/columns and reject cross-owner access.

## Workflows and versions

| Method | Route |
|---|---|
| GET/POST | `/api/workflows` |
| GET/PUT/DELETE | `/api/workflows/{workflow_id}` |
| PATCH | `/api/workflows/{workflow_id}/name` |
| PUT | `/api/workflows/{workflow_id}/autosave` |
| POST | `/api/workflows/validate` |
| GET/POST | `/api/workflows/{workflow_id}/versions` |
| GET/DELETE | `/api/workflows/{workflow_id}/versions/{version_id}` |
| POST | `/api/workflows/{workflow_id}/versions/{version_id}/restore` |

Stored graph JSON is preserved. Historical graph/node variants are normalized internally before validation or execution. Revision updates and version creation use explicit transaction boundaries and optimistic revision checks where supplied.

For compatibility, the workflow collection still includes graph data expected by the current frontend. The endpoint is paginated and payload-limited; future clients should prefer detail loading when the frontend contract is updated.

## Runs

| Method | Route |
|---|---|
| GET/POST | `/api/runs` |
| GET | `/api/runs/{run_id}` |
| GET | `/api/runs/{run_id}/progress` |
| GET | `/api/runs/{run_id}/logs` |
| GET | `/api/runs/{run_id}/node-executions` |
| GET | `/api/runs/{run_id}/nodes/{node_id}/preview` |
| POST | `/api/runs/{run_id}/cancel` |
| POST | `/api/runs/{run_id}/retry` |
| GET | `/api/runs/queue/health` |

Run creation preserves full-workflow and selected-node behavior. The selected node plus its upstream closure is captured in the immutable run snapshot. Summary lists omit large detail fields; run detail/progress retain frontend-consumed fields.

Run states exposed to clients are `queued`, `claimed`, `running`, `succeeded`, `failed`, `cancel_requested`, `cancelled`, `retry_wait`, and `dead_letter`. Existing historical strings are normalized when read or executed.

## Nodes

| Method | Route |
|---|---|
| GET | `/api/nodes` |
| GET | `/api/nodes/categories` |
| GET | `/api/nodes/catalog` |
| GET | `/api/nodes/{node_id}` |
| POST | `/api/nodes/custom` |
| GET/PUT/DELETE | `/api/nodes/custom/{node_id}` |

The frontend catalog is generated from the executable registry. Existing node IDs remain valid through compatibility aliases. Custom-node metadata routes remain available, but creation/execution returns a typed `CUSTOM_CODE_DISABLED` error when `ALLOW_CUSTOM_CODE=false`.

## Components

| Method | Route |
|---|---|
| GET/POST | `/api/components` |
| POST | `/api/components/import` |
| GET/PATCH/DELETE | `/api/components/{component_id}` |
| GET/POST | `/api/components/{component_id}/versions` |
| GET/DELETE | `/api/components/{component_id}/versions/{version_id}` |
| POST | `/api/components/{component_id}/versions/{version_id}/make-current` |
| GET | `/api/components/{component_id}/usage` |
| GET | `/api/components/{component_id}/export` |
| GET | `/api/components/{component_id}/registry` |

Component graph and version formats are preserved. Expansion occurs inside the canonical planner/runtime.

## Artifacts and cache

| Method | Route |
|---|---|
| GET/POST | `/api/artifacts` and `/api/artifacts/upload` |
| GET/DELETE | `/api/artifacts/{artifact_id}` |
| GET | `/api/artifacts/{artifact_id}/download-url` |
| GET | `/api/artifacts/{artifact_id}/download` |
| GET | `/api/artifacts/{artifact_id}/lineage` |
| GET | `/api/artifacts/usage` |
| GET | `/api/artifacts/cache/stats` |
| DELETE | `/api/artifacts/cache` |

Existing artifact metadata aliases and authenticated download behavior are preserved. Objects now move through explicit lifecycle states and UUID-based keys; original filenames remain display metadata only.

## Assistant

`POST /api/assistant/chat` is retained. The OpenAI dependency and client are loaded lazily. When the assistant is not configured, the endpoint returns a typed service/configuration error instead of preventing API startup.

## Intentional hardening that may change invalid requests

- Cross-owner resource access is rejected consistently.
- Collection sizes, preview rows/columns, graph size, logs and response bodies are bounded.
- Invalid node handles, duplicate graph IDs, incompatible ports and ambiguous mappings fail before execution.
- Unsafe upload names/content and oversized uploads are rejected.
- Wildcard credentialed CORS and default secrets are rejected in production.
- Development-default users cannot bootstrap in production.
- Custom code is disabled by default.

These changes do not alter valid current frontend requests.
