# Backend API compatibility

The reconstruction preserves existing paths, request bodies, envelope handling, bearer headers and workflow serialization. Backend DTOs remain in `shared/_types`; UI modules consume domain-specific clients.

## Envelope and errors

Both the current envelope and legacy unwrapped responses are accepted:

```text
{ success: true, data, meta?, request_id? }
{ success: false, error: { code, message, details }, request_id? }
```

`ApiError` preserves status, backend code, details and request ID. A 401 clears the compatibility token and notifies the authentication provider once.

## Authentication/profile

```text
POST /api/auth/login
GET  /api/auth/me
PUT  /api/auth/profile
POST /api/auth/profile-image
```

Bearer storage remains compatible with `iota-auth-token`, isolated behind `AuthTokenStorage` for a future secure-cookie migration.

## Projects, datasets and artifacts

```text
GET/POST        /api/projects
GET/PUT/DELETE  /api/projects/{id}
GET             /api/datasets?project_id={id}
POST            /api/datasets/upload
DELETE          /api/datasets/{id}
GET             /api/artifacts?project_id={id}
GET             /api/artifacts/usage?project_id={id}
GET             /api/artifacts/{id}/download-url
DELETE          /api/artifacts/{id}
GET             /api/artifacts/cache/stats?project_id={id}
DELETE          /api/artifacts/cache?project_id={id}
```

Uploads remain `multipart/form-data`; the client does not force a JSON content type.

## Workflows and versions

```text
GET/POST        /api/workflows
GET/DELETE      /api/workflows/{id}
PATCH           /api/workflows/{id}/name
PUT             /api/workflows/{id}/autosave
POST            /api/workflows/validate
GET/POST        /api/workflows/{id}/versions
GET/DELETE      /api/workflows/{id}/versions/{versionId}
POST            /api/workflows/{id}/versions/{versionId}/restore
```

Autosave continues to send the current backend graph shape and `base_revision`. Board tabs remain in graph metadata; new items contain output references rather than full payload copies.

## Runs

```text
POST /api/runs
GET  /api/runs?project_id={id}
GET  /api/runs/{id}
GET  /api/runs/{id}/progress
POST /api/runs/{id}/cancel
POST /api/runs/{id}/retry
```

The current backend exposes progress polling. The frontend uses one adaptive, abortable channel. Nginx also reserves `/api/runs/{id}/events|stream` with buffering disabled for a future SSE endpoint.

## Node catalog/custom nodes

```text
GET         /api/nodes/catalog
POST        /api/nodes/custom
GET/PUT/DELETE /api/nodes/custom/{id}
```

Catalog aliases and missing entries are normalized before rendering stored graphs.

## Components

```text
GET/POST        /api/components
POST            /api/components/import
GET/PATCH/DELETE /api/components/{id}
GET/POST        /api/components/{id}/versions
GET/DELETE      /api/components/{id}/versions/{versionId}
POST            /api/components/{id}/versions/{versionId}/make-current
GET             /api/components/{id}/export
GET             /api/components/{id}/registry
```

Project scoping and existing query parameter names are preserved.

## Assistant

```text
POST /api/assistant/chat
```

The request timeout remains longer than ordinary API calls and supports cancellation.
