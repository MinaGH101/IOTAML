# IOTA ML Backend Code Reference

This reference is generated from the backend source tree. It documents every Python module and every public class, function, and HTTP route. Inline module docstrings remain the authoritative description beside the code.

## Architecture map

| Area | Responsibility |
| --- | --- |
| `app/domains` | HTTP domain routes, schemas, services, repositories, and persistence models |
| `app/nodes` | Workflow node contracts and scientific/dataframe implementations |
| `app/workflow` | Validation, scheduling, execution, cancellation, errors, and runtime context |
| `app/services` | Shared application services, caching, queues, storage, users, and registry access |
| `app/infrastructure` | Storage and external-system adapters |
| `app/workers` | Reliable background workflow execution |
| `alembic` | Database schema migrations |
| `scripts` | Operator-facing maintenance commands |
| `tests` | Contract, regression, integration, and scientific-quality coverage |

## Module inventory

### `alembic/env.py`

Alembic database migration support for env.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `run_migrations_offline()` | function | Implements run migrations offline. |
| `run_migrations_online()` | function | Implements run migrations online. |

### `alembic/versions/20260712_0001_reliable_run_queue.py`

Create the application baseline and reliable run queue.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `upgrade()` | function | Implements upgrade. |
| `downgrade()` | function | Implements downgrade. |

### `alembic/versions/20260712_0002_artifact_storage_and_domains.py`

Add artifact storage metadata and dataset artifact references.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `upgrade()` | function | Implements upgrade. |
| `downgrade()` | function | Implements downgrade. |

### `alembic/versions/20260716_0003_node_cache_and_workflow_versions.py`

Add node cache, artifact lineage, workflow drafts and named versions.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `upgrade()` | function | Implements upgrade. |
| `downgrade()` | function | Implements downgrade. |

### `alembic/versions/20260716_0004_reusable_workflow_components.py`

Add reusable workflow components and immutable versions.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `upgrade()` | function | Implements upgrade. |
| `downgrade()` | function | Implements downgrade. |

### `alembic/versions/20260724_0005_schema_convergence.py`

Converge databases previously maintained by startup-time DDL.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `upgrade()` | function | Implements upgrade. |
| `downgrade()` | function | Implements downgrade. |

### `app/__init__.py`

Package initialization for the IOTA ML app package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/api/__init__.py`

Package initialization for the IOTA ML app api package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/api/routes_auth.py`

Legacy-compatible HTTP API routing for auth.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/api/routes_datasets.py`

Legacy-compatible HTTP API routing for datasets.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/api/routes_nodes.py`

Legacy-compatible HTTP API routing for nodes.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/api/routes_projects.py`

Legacy-compatible HTTP API routing for projects.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/api/routes_runs.py`

Legacy-compatible HTTP API routing for runs.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/api/routes_workflows.py`

Legacy-compatible HTTP API routing for workflows.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/config.py`

IOTA ML backend application module for config.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `Settings` | class | Settings domain type. |
| `get_settings()` | function | Implements get settings. |

### `app/core/__init__.py`

Package initialization for the IOTA ML app core package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/core/config.py`

Core backend infrastructure for config.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/core/database.py`

Core backend infrastructure for database.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/core/errors.py`

Core backend infrastructure for errors.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `AppError` | class | AppError domain type. |
| `NotFoundError` | class | NotFoundError domain type. |
| `ConflictError` | class | ConflictError domain type. |
| `ValidationAppError` | class | ValidationAppError domain type. |
| `PermissionDeniedError` | class | PermissionDeniedError domain type. |
| `StorageUnavailableError` | class | StorageUnavailableError domain type. |
| `QuotaExceededError` | class | QuotaExceededError domain type. |

### `app/core/http.py`

Core backend infrastructure for http.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ApiEnvelopeMiddleware` | class | ApiEnvelopeMiddleware domain type. |
| `install_exception_handlers(app: FastAPI)` | function | Implements install exception handlers. |

### `app/core/openapi.py`

Core backend infrastructure for openapi.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `install_openapi(app: FastAPI)` | function | Implements install openapi. |

### `app/core/request_context.py`

Core backend infrastructure for request context.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `set_request_id(value: str)` | function | Implements set request id. |
| `get_request_id()` | function | Implements get request id. |

### `app/core/responses.py`

Core backend infrastructure for responses.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `success_payload(data: Any=None, *, meta: dict[str, Any] \| None=None, request_id: str \| None=None)` | function | Implements success payload. |
| `error_payload(*, code: str, message: str, details: dict[str, Any] \| None=None, request_id: str \| None=None)` | function | Implements error payload. |

### `app/core/security.py`

Core backend infrastructure for security.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `sanitize_filename(name: str)` | function | Implements sanitize filename. |

### `app/database.py`

IOTA ML backend application module for database.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `Base` | class | Base domain type. |
| `get_db()` | function | Implements get db. |

### `app/domains/__init__.py`

Package initialization for the IOTA ML app domains package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/artifacts/__init__.py`

Package initialization for the IOTA ML app domains artifacts package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/artifacts/models.py`

Artifacts domain models for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `utcnow_naive()` | function | Implements utcnow naive. |
| `Artifact` | class | Artifact domain type. |
| `ArtifactLineage` | class | ArtifactLineage domain type. |
| `NodeCacheEntry` | class | NodeCacheEntry domain type. |
| `NodeExecution` | class | NodeExecution domain type. |

### `app/domains/artifacts/repository.py`

Artifacts domain repository for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ArtifactRepository` | class | ArtifactRepository domain type. |

### `app/domains/artifacts/routes.py`

Artifacts domain routes for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `upload_artifact(artifact_type: str=Query(default='artifact'), project_id: int \| None=Query(default=None), run_id: int \| None=Query(default=None), node_id: str \| None=Query(default=None), file: UploadFile=File(...), db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.post('/upload', response_model=ArtifactOut) — Implements upload artifact. |
| `list_artifacts(project_id: int \| None=None, run_id: int \| None=None, node_id: str \| None=None, artifact_type: str \| None=None, include_internal: bool=False, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('', response_model=list[ArtifactOut]) — Implements list artifacts. |
| `artifact_usage(project_id: int \| None=None, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/usage', response_model=ArtifactUsageOut) — Implements artifact usage. |
| `cache_stats(project_id: int \| None=None, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/cache/stats') — Implements cache stats. |
| `clear_cache(project_id: int \| None=None, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.delete('/cache') — Implements clear cache. |
| `artifact_lineage(artifact_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{artifact_id}/lineage') — Implements artifact lineage. |
| `get_artifact(artifact_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{artifact_id}', response_model=ArtifactOut) — Implements get artifact. |
| `get_download_url(artifact_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{artifact_id}/download-url', response_model=ArtifactDownloadOut) — Implements get download url. |
| `download_artifact(artifact_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{artifact_id}/download', include_in_schema=True) — Implements download artifact. |
| `remove_artifact(artifact_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.delete('/{artifact_id}') — Implements remove artifact. |

### `app/domains/artifacts/schemas.py`

Artifacts domain schemas for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ArtifactOut` | class | ArtifactOut domain type. |
| `ArtifactDownloadOut` | class | ArtifactDownloadOut domain type. |
| `ArtifactUsageOut` | class | ArtifactUsageOut domain type. |

### `app/domains/artifacts/service.py`

Artifacts domain service for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `create_artifact_from_upload(db: Session, *, upload: UploadFile, owner_username: str, artifact_type: str, project_id: int \| None=None, workflow_id: int \| None=None, run_id: int \| None=None, node_id: str \| None=None, expires_in_days: int \| None=None, allowed_extensions: set[str] \| None=None, allowed_content_types: set[str] \| None=None)` | function | Implements create artifact from upload. |
| `create_artifact_from_path(db: Session, *, source_path: Path, owner_username: str, artifact_type: str, project_id: int \| None=None, workflow_id: int \| None=None, run_id: int \| None=None, node_id: str \| None=None, expires_in_days: int \| None=None, logical_name: str \| None=None, content_type_override: str \| None=None, cache_key: str \| None=None, schema_json: dict[str, Any] \| None=None, metadata_json: dict[str, Any] \| None=None, pinned: bool=False)` | function | Implements create artifact from path. |
| `owned_artifact(db: Session, artifact_id: int, owner_username: str)` | function | Implements owned artifact. |
| `materialize_artifact(db: Session, artifact_id: int, *, cache_group: str='artifacts')` | function | Implements materialize artifact. |
| `artifact_download_url(db: Session, artifact_id: int, owner_username: str)` | function | Implements artifact download url. |
| `delete_artifact(db: Session, artifact_id: int, owner_username: str, *, force: bool=False)` | function | Implements delete artifact. |
| `usage_payload(db: Session, *, owner_username: str, project_id: int \| None=None)` | function | Implements usage payload. |
| `cleanup_expired_artifacts(db: Session, limit: int=200)` | function | Implements cleanup expired artifacts. |
| `ingest_run_artifact_paths(db: Session, run: Run, payload: Any)` | function | Implements ingest run artifact paths. |

### `app/domains/assistant/__init__.py`

Package initialization for the IOTA ML app domains assistant package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/assistant/catalog.py`

Assistant domain catalog for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `get_full_catalog()` | function | Return the live node catalog from the backend registry. |
| `list_node_summaries(*, category: str \| None=None, query: str \| None=None, implemented_only: bool=True)` | function | Return compact node summaries suitable for an AI tool response. |
| `get_node_details(node_id: str)` | function | Return one canonical node definition with ports and settings. |

### `app/domains/assistant/router.py`

Assistant domain router for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ChatRequest` | class | ChatRequest domain type. |
| `ChatResponse` | class | ChatResponse domain type. |
| `chat(request: ChatRequest, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.post('/chat', response_model=ChatResponse) — Implements chat. |

### `app/domains/assistant/service.py`

Assistant domain service for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `AssistantNotConfiguredError` | class | Raised only when the optional assistant is used without credentials. |
| `AssistantService` | class | AssistantService domain type. |

### `app/domains/assistant/tools.py`

Assistant domain tools for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `execute_catalog_tool(tool_name: str, arguments: dict[str, Any])` | function | Implements execute catalog tool. |

### `app/domains/assistant/workflow_tools.py`

Assistant domain workflow tools for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `get_workflow_context(db: Session, workflow_id: int, owner_username: str)` | function | Implements get workflow context. |
| `validate_workflow_context(db: Session, workflow_id: int, owner_username: str)` | function | Implements validate workflow context. |

### `app/domains/auth/__init__.py`

Package initialization for the IOTA ML app domains auth package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/auth/models.py`

Auth currently uses the existing JSON user store.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/auth/routes.py`

Auth domain routes for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `login(payload: LoginIn)` | HTTP route | router.post('/login', response_model=LoginOut) — Implements login. |
| `me(current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/me', response_model=UserProfile) — Implements me. |
| `upload_profile_image(file: UploadFile=File(...), current_user: dict=Depends(get_current_user))` | HTTP route | router.post('/profile-image', response_model=UserProfile) — Implements upload profile image. |
| `update_profile(payload: UserProfileUpdate, current_user: dict=Depends(get_current_user))` | HTTP route | router.put('/profile', response_model=UserProfile) — Implements update profile. |

### `app/domains/auth/schemas.py`

Auth domain schemas for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/auth/service.py`

Auth domain service for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/components/__init__.py`

Reusable workflow component domain.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/components/models.py`

Components domain models for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/components/repository.py`

Components domain repository for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ComponentRepository` | class | ComponentRepository domain type. |

### `app/domains/components/routes.py`

Components domain routes for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `list_all(project_id: int \| None=None, include_archived: bool=False, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('', response_model=list[ComponentOut]) — Implements list all. |
| `create(payload: ComponentCreate, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.post('', response_model=ComponentOut) — Implements create. |
| `import_package(payload: ComponentImportPackage, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.post('/import', response_model=ComponentOut) — Implements import package. |
| `get_one(component_id: int, project_id: int \| None=None, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{component_id}', response_model=ComponentOut) — Implements get one. |
| `update(component_id: int, payload: ComponentUpdate, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.patch('/{component_id}', response_model=ComponentOut) — Implements update. |
| `remove(component_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.delete('/{component_id}') — Implements remove. |
| `versions(component_id: int, project_id: int \| None=None, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{component_id}/versions', response_model=list[ComponentVersionSummaryOut]) — Implements versions. |
| `version(component_id: int, version_id: int, project_id: int \| None=None, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{component_id}/versions/{version_id}', response_model=ComponentVersionOut) — Implements version. |
| `save_version(component_id: int, payload: ComponentVersionCreate, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.post('/{component_id}/versions', response_model=ComponentVersionOut) — Implements save version. |
| `make_current(component_id: int, version_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.post('/{component_id}/versions/{version_id}/make-current', response_model=ComponentOut) — Implements make current. |
| `remove_version(component_id: int, version_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.delete('/{component_id}/versions/{version_id}') — Implements remove version. |
| `usage(component_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{component_id}/usage') — Implements usage. |
| `export(component_id: int, version_id: int \| None=None, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{component_id}/export') — Implements export. |
| `registry(component_id: int, project_id: int \| None=None, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{component_id}/registry') — Implements registry. |

### `app/domains/components/schemas.py`

Components domain schemas for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ComponentPort` | class | ComponentPort domain type. |
| `ExposedComponentParameter` | class | ExposedComponentParameter domain type. |
| `ComponentInterface` | class | ComponentInterface domain type. |
| `ComponentCreate` | class | ComponentCreate domain type. |
| `ComponentVersionCreate` | class | ComponentVersionCreate domain type. |
| `ComponentUpdate` | class | ComponentUpdate domain type. |
| `ComponentVersionOut` | class | ComponentVersionOut domain type. |
| `ComponentVersionSummaryOut` | class | ComponentVersionSummaryOut domain type. |
| `ComponentOut` | class | ComponentOut domain type. |
| `ComponentImportPackage` | class | ComponentImportPackage domain type. |

### `app/domains/components/service.py`

Components domain service for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `component_registry_id(component_id: int, version_id: int)` | function | Implements component registry id. |
| `parse_component_registry_id(value: str)` | function | Implements parse component registry id. |
| `usage_count(db: Session, component_id: int, version_id: int \| None=None)` | function | Implements usage count. |
| `component_to_registry_node(component: WorkflowComponent, version: WorkflowComponentVersion)` | function | Implements component to registry node. |
| `create_component(db: Session, payload: ComponentCreate, owner: str, *, commit: bool=True)` | function | Implements create component. |
| `list_components(db: Session, owner: str, project_id: int \| None=None, include_archived: bool=False)` | function | Implements list components. |
| `get_component(db: Session, component_id: int, owner: str, project_id: int \| None=None)` | function | Implements get component. |
| `get_owned_component(db: Session, component_id: int, owner: str)` | function | Implements get owned component. |
| `current_version(db: Session, component: WorkflowComponent)` | function | Implements current version. |
| `create_component_version(db: Session, component_id: int, payload: ComponentVersionCreate, owner: str)` | function | Implements create component version. |
| `update_component(db: Session, component_id: int, payload: ComponentUpdate, owner: str)` | function | Implements update component. |
| `delete_component_version(db: Session, component_id: int, version_id: int, owner: str)` | function | Implements delete component version. |
| `set_current_version(db: Session, component_id: int, version_id: int, owner: str)` | function | Implements set current version. |
| `delete_component(db: Session, component_id: int, owner: str)` | function | Implements delete component. |
| `export_component(db: Session, component_id: int, owner: str, version_id: int \| None=None)` | function | Implements export component. |
| `import_component(db: Session, package: ComponentImportPackage, owner: str)` | function | Implements import component. |

### `app/domains/datasets/__init__.py`

Package initialization for the IOTA ML app domains datasets package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/datasets/models.py`

Datasets domain models for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/datasets/repository.py`

Datasets domain repository for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `DatasetRepository` | class | DatasetRepository domain type. |

### `app/domains/datasets/routes.py`

Datasets domain routes for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `upload_dataset_route(file: UploadFile=File(...), project_id: int \| None=Form(default=None), db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.post('/upload', response_model=DatasetOut) — Implements upload dataset route. |
| `list_datasets(project_id: int \| None=None, db: Session=Depends(get_db))` | HTTP route | router.get('', response_model=list[DatasetOut]) — Implements list datasets. |
| `preview_dataset(dataset_id: int, db: Session=Depends(get_db))` | HTTP route | router.get('/{dataset_id}/preview') — Implements preview dataset. |
| `delete_dataset_route(dataset_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.delete('/{dataset_id}') — Implements delete dataset route. |

### `app/domains/datasets/schemas.py`

Datasets domain schemas for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/datasets/service.py`

Datasets domain service for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `column_info(df: pd.DataFrame)` | function | Implements column info. |
| `materialize_dataset(db: Session, dataset: Dataset)` | function | Implements materialize dataset. |
| `read_dataset(db: Session, dataset: Dataset, max_rows: int \| None=None)` | function | Implements read dataset. |
| `upload_dataset(db: Session, *, upload: UploadFile, project_id: int \| None, owner_username: str)` | function | Implements upload dataset. |
| `get_dataset(db: Session, dataset_id: int)` | function | Implements get dataset. |
| `delete_dataset(db: Session, dataset_id: int, owner_username: str)` | function | Implements delete dataset. |

### `app/domains/nodes/__init__.py`

Package initialization for the IOTA ML app domains nodes package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/nodes/models.py`

Nodes domain models for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/nodes/repository.py`

Nodes domain repository for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `CustomNodeRepository` | class | CustomNodeRepository domain type. |

### `app/domains/nodes/routes.py`

Nodes domain routes for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `list_nodes(current_user: dict=Depends(get_current_user), db: Session=Depends(get_db))` | HTTP route | router.get('') — Implements list nodes. |
| `list_categories()` | HTTP route | router.get('/categories') — Implements list categories. |
| `get_catalog(current_user: dict=Depends(get_current_user), db: Session=Depends(get_db))` | HTTP route | router.get('/catalog') — Implements get catalog. |
| `create_user_node(payload: CustomNodeCreate, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db))` | HTTP route | router.post('/custom') — Implements create user node. |
| `get_user_node(node_id: str, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db))` | HTTP route | router.get('/custom/{node_id}') — Implements get user node. |
| `update_user_node(node_id: str, payload: CustomNodeCreate, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db))` | HTTP route | router.put('/custom/{node_id}') — Implements update user node. |
| `delete_user_node(node_id: str, current_user: dict=Depends(get_current_user), db: Session=Depends(get_db))` | HTTP route | router.delete('/custom/{node_id}') — Implements delete user node. |
| `get_node(node_id: str)` | HTTP route | router.get('/{node_id}') — Implements get node. |

### `app/domains/nodes/schemas.py`

Nodes domain schemas for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/nodes/service.py`

Nodes domain service for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/projects/__init__.py`

Package initialization for the IOTA ML app domains projects package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/projects/models.py`

Projects domain models for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/projects/repository.py`

Projects domain repository for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ProjectRepository` | class | ProjectRepository domain type. |

### `app/domains/projects/routes.py`

Projects domain routes for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `create(payload: ProjectCreate, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.post('', response_model=ProjectOut) — Implements create. |
| `list_all(db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('', response_model=list[ProjectOut]) — Implements list all. |
| `get_one(project_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{project_id}', response_model=ProjectOut) — Implements get one. |
| `update(project_id: int, payload: ProjectUpdate, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.put('/{project_id}', response_model=ProjectOut) — Implements update. |
| `remove(project_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.delete('/{project_id}') — Implements remove. |

### `app/domains/projects/schemas.py`

Projects domain schemas for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/projects/service.py`

Projects domain service for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `to_output(project: Project, db: Session)` | function | Implements to output. |
| `create_project(db: Session, payload: ProjectCreate, current_user: dict)` | function | Implements create project. |
| `get_project(db: Session, project_id: int)` | function | Implements get project. |
| `update_project(db: Session, project_id: int, payload: ProjectUpdate)` | function | Implements update project. |
| `delete_project(db: Session, project_id: int)` | function | Implements delete project. |

### `app/domains/runs/__init__.py`

Package initialization for the IOTA ML app domains runs package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/runs/models.py`

Runs domain models for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/runs/repository.py`

Runs domain repository for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `RunRepository` | class | RunRepository domain type. |

### `app/domains/runs/routes.py`

HTTP endpoints for creating, inspecting, cancelling, and retrying runs.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `create_run(payload: RunCreate, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user), idempotency_header: str \| None=Header(default=None, alias='Idempotency-Key'))` | HTTP route | router.post('', response_model=RunOut) — Implements create run. |
| `list_runs(project_id: int \| None=None, status: str \| None=None, limit: int=50, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('', response_model=list[RunSummaryOut]) — Implements list runs. |
| `get_queue_health(db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/queue/health') — Implements get queue health. |
| `get_node_executions(run_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{run_id}/node-executions') — Implements get node executions. |
| `get_run(run_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{run_id}', response_model=RunOut) — Implements get run. |
| `get_run_progress(run_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{run_id}/progress') — Implements get run progress. |
| `get_run_logs(run_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{run_id}/logs') — Implements get run logs. |
| `get_node_preview(run_id: int, node_id: str, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{run_id}/nodes/{node_id}/preview') — Implements get node preview. |
| `cancel_run(run_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.post('/{run_id}/cancel', response_model=RunOut) — Implements cancel run. |
| `retry_run(run_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.post('/{run_id}/retry', response_model=RunOut) — Implements retry run. |

### `app/domains/runs/schemas.py`

Runs domain schemas for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/runs/service.py`

Runs domain service for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/workflows/__init__.py`

Package initialization for the IOTA ML app domains workflows package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/workflows/models.py`

Workflows domain models for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/workflows/repository.py`

Workflows domain repository for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `WorkflowRepository` | class | WorkflowRepository domain type. |

### `app/domains/workflows/routes.py`

Workflows domain routes for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `validate_workflow(payload: dict)` | HTTP route | router.post('/validate') — Implements validate workflow. |
| `create(payload: WorkflowCreate, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.post('', response_model=WorkflowOut) — Implements create. |
| `list_all(project_id: int \| None=None, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('', response_model=list[WorkflowOut]) — Implements list all. |
| `get_one(workflow_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{workflow_id}', response_model=WorkflowOut) — Implements get one. |
| `update(workflow_id: int, payload: WorkflowCreate, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.put('/{workflow_id}', response_model=WorkflowOut) — Implements update. |
| `rename(workflow_id: int, payload: WorkflowRenameIn, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.patch('/{workflow_id}/name', response_model=WorkflowOut) — Implements rename. |
| `remove(workflow_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.delete('/{workflow_id}') — Implements remove. |
| `autosave(workflow_id: int, payload: WorkflowAutosaveIn, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.put('/{workflow_id}/autosave', response_model=WorkflowOut) — Implements autosave. |
| `save_version(workflow_id: int, payload: WorkflowVersionCreate, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.post('/{workflow_id}/versions', response_model=WorkflowVersionOut) — Implements save version. |
| `versions(workflow_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{workflow_id}/versions', response_model=list[WorkflowVersionSummaryOut]) — Implements versions. |
| `version(workflow_id: int, version_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.get('/{workflow_id}/versions/{version_id}', response_model=WorkflowVersionOut) — Implements version. |
| `restore(workflow_id: int, version_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.post('/{workflow_id}/versions/{version_id}/restore', response_model=WorkflowOut) — Implements restore. |
| `remove_version(workflow_id: int, version_id: int, db: Session=Depends(get_db), current_user: dict=Depends(get_current_user))` | HTTP route | router.delete('/{workflow_id}/versions/{version_id}') — Implements remove version. |

### `app/domains/workflows/schemas.py`

Workflows domain schemas for the IOTA ML backend.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/domains/workflows/service.py`

Workflows domain service for the IOTA ML backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `validate_graph(graph: dict)` | function | Implements validate graph. |
| `create_workflow(db: Session, payload: WorkflowCreate, owner_username: str)` | function | Implements create workflow. |
| `get_workflow(db: Session, workflow_id: int, owner_username: str)` | function | Implements get workflow. |
| `update_workflow(db: Session, workflow_id: int, payload: WorkflowCreate, owner_username: str)` | function | Implements update workflow. |
| `rename_workflow(db: Session, workflow_id: int, name: str, owner_username: str)` | function | Implements rename workflow. |
| `delete_workflow(db: Session, workflow_id: int, owner_username: str)` | function | Implements delete workflow. |
| `autosave_workflow(db: Session, workflow_id: int, payload: WorkflowAutosaveIn, owner_username: str)` | function | Implements autosave workflow. |
| `create_version(db: Session, workflow_id: int, payload: WorkflowVersionCreate, owner_username: str)` | function | Implements create version. |
| `list_versions(db: Session, workflow_id: int, owner_username: str)` | function | Implements list versions. |
| `get_version(db: Session, workflow_id: int, version_id: int, owner_username: str)` | function | Implements get version. |
| `restore_version(db: Session, workflow_id: int, version_id: int, owner_username: str)` | function | Implements restore version. |
| `delete_version(db: Session, workflow_id: int, version_id: int, owner_username: str)` | function | Implements delete version. |

### `app/infrastructure/__init__.py`

Package initialization for the IOTA ML app infrastructure package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/infrastructure/storage/__init__.py`

Package initialization for the IOTA ML app infrastructure storage package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/infrastructure/storage/base.py`

Infrastructure adapter for base.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `StorageBackend` | class | StorageBackend domain type. |

### `app/infrastructure/storage/local.py`

Infrastructure adapter for local.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `LocalStorageBackend` | class | LocalStorageBackend domain type. |

### `app/infrastructure/storage/minio_backend.py`

Infrastructure adapter for minio backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `MinioStorageBackend` | class | MinioStorageBackend domain type. |

### `app/infrastructure/storage/service.py`

Infrastructure adapter for service.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `get_storage_backend()` | function | Implements get storage backend. |

### `app/main.py`

IOTA ML backend application module for main.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `startup()` | function | Implements startup. |
| `health()` | HTTP route | app.get('/health') — Implements health. |
| `readiness()` | HTTP route | app.get('/health/ready') — Implements readiness. |

### `app/models.py`

IOTA ML backend application module for models.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `utcnow_naive()` | function | Implements utcnow naive. |
| `Project` | class | Project domain type. |
| `Dataset` | class | Dataset domain type. |
| `Workflow` | class | Workflow domain type. |
| `WorkflowVersion` | class | WorkflowVersion domain type. |
| `WorkflowComponent` | class | WorkflowComponent domain type. |
| `WorkflowComponentVersion` | class | WorkflowComponentVersion domain type. |
| `Run` | class | Run domain type. |
| `CustomNode` | class | CustomNode domain type. |

### `app/nodes/__init__.py`

Package initialization for the IOTA ML app nodes package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/nodes/anomaly_detection/__init__.py`

Package initialization for the IOTA ML app nodes anomaly detection package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/nodes/anomaly_detection/anomalies.py`

Shared anomaly-detection engine for two-dataframe workflows.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `canonical_column_name(column: str)` | function | Return the base variable name used to match transformed columns. |
| `ColumnPair` | class | Resolved calculation/detection columns for one logical variable. |
| `AnomalyResult` | class | All machine-readable and UI-ready outputs produced by one detector run. |
| `DualDataAnomalyDetector` | class | Calculate anomaly classes on one dataframe and return values from another. |
| `AnomalyDetection` | class | Backward-compatible service wrapper around the dual-data detector. |

### `app/nodes/anomaly_detection/input_selection.py`

Resolve one of several connected dataframe sources for anomaly nodes.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `selected_input_dataframe(inputs: dict[str, Any], source_node_id: Any, role_label: str)` | function | Return the connected dataframe selected for one anomaly role. |

### `app/nodes/anomaly_detection/iqr_node.py`

IQR anomaly workflow node using separate calculation/detection inputs.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `IQROutlierNode` | class | Calculate Q1/Q3 IQR classes and report aligned values from another frame. |

### `app/nodes/anomaly_detection/output_contract.py`

Single authoritative visible-output contract for anomaly nodes.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `anomaly_display_outputs(node: dict[str, Any], result: Any, max_rows: int, *, threshold_title: str)` | function | Create the exact three-section anomaly display contract. |
| `anomaly_node_response(result: Any, display_outputs: list[dict[str, Any]])` | function | Return exactly three dataframe ports and no legacy JSON/report output. |

### `app/nodes/anomaly_detection/sorted_gap_node.py`

Sorted-gap outlier node for detecting abrupt jumps in distribution tails.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `TailResult` | class | Boundary and diagnostic values for one detected distribution tail. |
| `SortedGapOutlierNode` | class | Detect and optionally replace abrupt lower/upper-tail sorted gaps. |

### `app/nodes/anomaly_detection/test_anomalies.py`

Regression tests for dual-dataframe anomaly mapping and class outputs.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `DualDataAnomalyDetectorTests` | class | DualDataAnomalyDetectorTests domain type. |

### `app/nodes/anomaly_detection/threshold_node.py`

Manual-threshold anomaly node with separate calculation/detection inputs.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ThresholdAnomalyNode` | class | Assign manual classes and report aligned values from another dataframe. |

### `app/nodes/anomaly_detection/z_score_node.py`

Z-score anomaly workflow node using separate calculation/detection inputs.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ZScoreOutlierNode` | class | Calculate X + kS classes and report aligned values from another frame. |

### `app/nodes/base.py`

Declarative node, port, setting, and execution interfaces.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `PortDefinition` | class | PortDefinition domain type. |
| `SettingDefinition` | class | SettingDefinition domain type. |
| `NodeDefinition` | class | NodeDefinition domain type. |
| `BaseNode` | class | BaseNode domain type. |
| `port(id: str, name: str, type: str, required: bool=True, multiple: bool=False)` | function | Implements port. |
| `setting(name: str, label: str, type: str, default: Any=None, required: bool=False, options: list[Any] \| None=None, supports_dynamic: bool=True, help: str='')` | function | Implements setting. |

### `app/nodes/cleaning/__init__.py`

Package initialization for the IOTA ML app nodes cleaning package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/nodes/cleaning/convert_type_node.py`

Workflow node implementation for convert type node in the cleaning family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ConvertTypeNode` | class | ConvertTypeNode domain type. |

### `app/nodes/cleaning/detection_limit_node.py`

Workflow node implementation for detection limit node in the cleaning family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `DetectionLimitHandlingNode` | class | DetectionLimitHandlingNode domain type. |

### `app/nodes/cleaning/filter_dataframe_node.py`

Workflow node implementation for filter dataframe node in the cleaning family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `FilterDataFrameNode` | class | FilterDataFrameNode domain type. |

### `app/nodes/cleaning/imputation_node.py`

Workflow node implementation for imputation node in the cleaning family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ImputationNode` | class | ImputationNode domain type. |

### `app/nodes/cleaning/replace_values_node.py`

Workflow node implementation for replace values node in the cleaning family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ReplaceValuesNode` | class | ReplaceValuesNode domain type. |

### `app/nodes/cleaning/select_columns_node.py`

Workflow node implementation for select columns node in the cleaning family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `SelectColumnsNode` | class | SelectColumnsNode domain type. |

### `app/nodes/data_input/__init__.py`

Package initialization for the IOTA ML app nodes data input package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/nodes/data_input/csv_node.py`

Workflow node implementation for csv node in the data input family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `CsvInputNode` | class | CsvInputNode domain type. |

### `app/nodes/data_input/manual_json_node.py`

Workflow node implementation for manual json node in the data input family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ManualJsonInputNode` | class | ManualJsonInputNode domain type. |

### `app/nodes/data_input/manual_trigger_node.py`

Workflow node implementation for manual trigger node in the data input family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ManualTriggerNode` | class | ManualTriggerNode domain type. |

### `app/nodes/export_report/__init__.py`

Package initialization for the IOTA ML app nodes export report package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/nodes/export_report/export_nodes.py`

Workflow node implementation for export nodes in the export report family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ExportCsvNode` | class | ExportCsvNode domain type. |
| `ExportJsonNode` | class | ExportJsonNode domain type. |
| `SimpleReportNode` | class | SimpleReportNode domain type. |

### `app/nodes/generated_catalog.py`

IOTA ML backend application module for generated catalog.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/nodes/inspection/__init__.py`

Package initialization for the IOTA ML app nodes inspection package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/nodes/inspection/correlation_node.py`

Workflow node implementation for correlation node in the inspection family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `CorrelationMatrixNode` | class | CorrelationMatrixNode domain type. |

### `app/nodes/inspection/data_overview_node.py`

Workflow node implementation for data overview node in the inspection family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `DataOverviewNode` | class | DataOverviewNode domain type. |

### `app/nodes/inspection/duplicate_error_node.py`

Workflow node implementation for duplicate error node in the inspection family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `DuplicateSampleErrorNode` | class | DuplicateSampleErrorNode domain type. |

### `app/nodes/inspection/missing_values_node.py`

Workflow node implementation for missing values node in the inspection family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `MissingValuesReportNode` | class | MissingValuesReportNode domain type. |

### `app/nodes/inspection/statistical_report_node.py`

Workflow node implementation for statistical report node in the inspection family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `StatisticalReportNode` | class | StatisticalReportNode domain type. |

### `app/nodes/io.py`

Shared dataframe, lineage, input-resolution, and visible-output contracts.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `safe_json(value: Any)` | function | Implements safe json. |
| `output(node_id: str, title: str, kind: str, **payload: Any)` | function | Implements output. |
| `table_output(node_id: str, title: str, df: pd.DataFrame, max_rows: int=100)` | function | Implements table output. |
| `metrics_output(node_id: str, title: str, metrics: dict[str, Any])` | function | Implements metrics output. |
| `json_output(node_id: str, title: str, value: Any)` | function | Implements json output. |
| `node_label(node: dict[str, Any])` | function | Implements node label. |
| `input_by_port(inputs: dict[str, Any], port_id: str)` | function | Implements input by port. |
| `dataframe_payload(inputs: dict[str, Any], port_id: str \| None=None)` | function | Implements dataframe payload. |
| `dataframe_result(df: pd.DataFrame, id_column: str \| None=None, meta: dict[str, Any] \| None=None, *, active_columns: list[str] \| None=None, source_columns: list[str] \| None=None, source_df: pd.DataFrame \| None=None, source_ref: str \| Path \| None=None, lineage: DataFrameLineage \| None=None, row_keys: pd.Index \| list[int] \| None=None, reset_lineage: bool=False, **extra: Any)` | function | Implements dataframe result. |
| `inherit_dataframe_contract(payload: DataFramePayload, upstream: DataFramePayload \| None)` | function | Attach inherited ID/source lineage to a node dataframe result. |
| `apply_dataframe_contract(result: Any, inputs: dict[str, Any])` | function | Normalize dataframe results and inherit the upstream ID contract. |
| `first_upstream_df(inputs: dict[str, Any], port_id: str \| None=None)` | function | Borrow the active upstream frame. |
| `first_upstream_id_column(inputs: dict[str, Any], port_id: str \| None=None)` | function | Implements first upstream id column. |
| `all_dataframe_payloads(inputs: dict[str, Any], port_id: str \| None=None)` | function | Implements all dataframe payloads. |
| `all_upstream_dfs(inputs: dict[str, Any], port_id: str \| None=None)` | function | Implements all upstream dfs. |
| `first_json_payload(inputs: dict[str, Any], port_id: str \| None=None)` | function | Implements first json payload. |
| `first_model_payload(inputs: dict[str, Any])` | function | Implements first model payload. |
| `first_model(inputs: dict[str, Any])` | function | Implements first model. |
| `ensure_df(df: pd.DataFrame \| None, node_id: str)` | function | Require a non-empty dataframe and identify the failing input contract. |
| `calculation_columns(df: pd.DataFrame)` | function | Implements calculation columns. |
| `calculation_df(df: pd.DataFrame)` | function | Implements calculation df. |
| `numeric_df(df: pd.DataFrame)` | function | Implements numeric df. |
| `coerce_numeric_series(df: pd.DataFrame, column: str)` | function | Implements coerce numeric series. |
| `selected_columns(settings: dict[str, Any], df: pd.DataFrame)` | function | Implements selected columns. |
| `parse_number_list(value: Any, default: list[float] \| None=None)` | function | Parse comma/space separated numeric thresholds like '3,2' or '1.5, 2.5'. |
| `read_dataset_path(dataset_path: str \| Path)` | function | Implements read dataset path. |
| `read_dataset(dataset_id: Any)` | function | Implements read dataset. |
| `materialize_dataset_path(dataset_id: Any)` | function | Implements materialize dataset path. |
| `run_file_path(context: Any, node_id: str, suffix: str)` | function | Implements run file path. |

### `app/nodes/ml_analysis/__init__.py`

Package initialization for the IOTA ML app nodes ml analysis package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/nodes/ml_analysis/model_analysis_nodes.py`

Workflow node implementation for model analysis nodes in the ml analysis family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `collect_data_pairs(inputs: dict[str, Any], model_payload: ModelPayload)` | function | Implements collect data pairs. |
| `PredictionPreviewNode` | class | PredictionPreviewNode domain type. |
| `MetricsSummaryNode` | class | MetricsSummaryNode domain type. |
| `FeatureImportanceNode` | class | FeatureImportanceNode domain type. |

### `app/nodes/ml_data_processing/__init__.py`

Package initialization for the IOTA ML app nodes ml data processing package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/nodes/ml_data_processing/feature_selection_nodes.py`

Workflow node implementation for feature selection nodes in the ml data processing family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `MutualInfoFeatureScoreNode` | class | MutualInfoFeatureScoreNode domain type. |
| `FRegressionFeatureScoreNode` | class | FRegressionFeatureScoreNode domain type. |

### `app/nodes/ml_data_processing/kfold_node.py`

Workflow node implementation for kfold node in the ml data processing family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `KFoldSplitNode` | class | KFoldSplitNode domain type. |

### `app/nodes/ml_data_processing/ml_utils.py`

Workflow node implementation for ml utils in the ml data processing family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `feature_target_from_inputs(inputs: dict[str, Any], settings: dict[str, Any], context: Any, node_id: str)` | function | Implements feature target from inputs. |
| `training_frame(x: pd.DataFrame, y: pd.Series, target: str)` | function | Implements training frame. |

### `app/nodes/ml_data_processing/select_features_node.py`

Workflow node implementation for select features node in the ml data processing family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `SelectFeaturesNode` | class | SelectFeaturesNode domain type. |

### `app/nodes/ml_data_processing/set_target_node.py`

Workflow node implementation for set target node in the ml data processing family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `SetTargetNode` | class | SetTargetNode domain type. |

### `app/nodes/ml_data_processing/split_node.py`

Workflow node implementation for split node in the ml data processing family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `TrainTestSplitNode` | class | TrainTestSplitNode domain type. |

### `app/nodes/ml_training/__init__.py`

Package initialization for the IOTA ML app nodes ml training package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/nodes/ml_training/model_nodes.py`

Workflow node implementation for model nodes in the ml training family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `encode_predict(x: pd.DataFrame, encoded_columns: list[str])` | function | Implements encode predict. |
| `predict_with_payload(payload: ModelPayload, x: pd.DataFrame, fold: int \| None=None)` | function | Implements predict with payload. |
| `LinearRegressionNode` | class | LinearRegressionNode domain type. |
| `RidgeRegressionNode` | class | RidgeRegressionNode domain type. |
| `LassoRegressionNode` | class | LassoRegressionNode domain type. |
| `ElasticNetRegressionNode` | class | ElasticNetRegressionNode domain type. |
| `DecisionTreeRegressorNode` | class | DecisionTreeRegressorNode domain type. |
| `RandomForestRegressorNode` | class | RandomForestRegressorNode domain type. |
| `ExtraTreesRegressorNode` | class | ExtraTreesRegressorNode domain type. |
| `GradientBoostingRegressorNode` | class | GradientBoostingRegressorNode domain type. |
| `HistGradientBoostingRegressorNode` | class | HistGradientBoostingRegressorNode domain type. |
| `KNNRegressorNode` | class | KNNRegressorNode domain type. |
| `LogisticRegressionNode` | class | LogisticRegressionNode domain type. |
| `DecisionTreeClassifierNode` | class | DecisionTreeClassifierNode domain type. |
| `RandomForestClassifierNode` | class | RandomForestClassifierNode domain type. |
| `ExtraTreesClassifierNode` | class | ExtraTreesClassifierNode domain type. |
| `GradientBoostingClassifierNode` | class | GradientBoostingClassifierNode domain type. |
| `HistGradientBoostingClassifierNode` | class | HistGradientBoostingClassifierNode domain type. |
| `KNNClassifierNode` | class | KNNClassifierNode domain type. |
| `SVCClassifierNode` | class | SVCClassifierNode domain type. |
| `LinearSVCClassifierNode` | class | LinearSVCClassifierNode domain type. |
| `GaussianNBClassifierNode` | class | GaussianNBClassifierNode domain type. |

### `app/nodes/registry.py`

Authoritative runtime node registry and port compatibility catalog.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `validate_registry_integrity()` | function | Fail fast when catalog definitions drift or become internally invalid. |
| `catalog_metadata()` | function | Implements catalog metadata. |
| `canonical_node_id(node_id: str)` | function | Implements canonical node id. |
| `all_nodes()` | function | Implements all nodes. |
| `all_node_runners()` | function | Implements all node runners. |
| `all_nodes_api()` | function | Implements all nodes api. |
| `node_map()` | function | Implements node map. |
| `runner_map()` | function | Implements runner map. |
| `get_node(node_id: str)` | function | Implements get node. |
| `get_node_runner(node_id: str)` | function | Implements get node runner. |
| `get_categories()` | function | Implements get categories. |

### `app/nodes/table_file.py`

IOTA ML backend application module for table file.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `read_uploaded_table(value: Any, *, max_bytes: int=MAX_INLINE_TABLE_BYTES)` | function | Read a small CSV/TSV/XLSX embedded in workflow settings. |

### `app/nodes/transformation/__init__.py`

Package initialization for the IOTA ML app nodes transformation package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/nodes/transformation/normalization_node.py`

Workflow node implementation for normalization node in the transformation family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `NormalizationNode` | class | NormalizationNode domain type. |

### `app/nodes/transformation/ratio_node.py`

Workflow node implementation for ratio node in the transformation family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `RatioCalculatorNode` | class | RatioCalculatorNode domain type. |

### `app/nodes/transformation/scaler_nodes.py`

Workflow node implementation for scaler nodes in the transformation family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ScalerNode` | class | ScalerNode domain type. |

### `app/nodes/transformation/transpose_node.py`

Workflow node implementation for transpose node in the transformation family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `TransposeDataFrameNode` | class | TransposeDataFrameNode domain type. |

### `app/nodes/types.py`

IOTA ML backend application module for types.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `DataFrameLineage` | class | Immutable, shared source columns for one dataframe lineage. |
| `DataFramePayload` | class | A dataframe plus workflow metadata carried through a dataframe port. |
| `JsonPayload` | class | JsonPayload domain type. |
| `ModelPayload` | class | ModelPayload domain type. |
| `PlotPayload` | class | PlotPayload domain type. |
| `FilePayload` | class | FilePayload domain type. |

### `app/nodes/utilities/__init__.py`

Package initialization for the IOTA ML app nodes utilities package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/nodes/utilities/custom_python_node.py`

Workflow node implementation for custom python node in the utilities family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `CustomPythonNode` | class | CustomPythonNode domain type. |

### `app/nodes/utilities/interactive_table_node.py`

Editable dataframe node with a persisted operation-based table state.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `InteractiveTableNode` | class | Let users edit/select a dataframe and emit the clean persisted result. |

### `app/nodes/utilities/merge_dataframes_node.py`

Multi-input dataframe combination node.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `MergeDataFramesNode` | class | Combine two or more connected dataframes along rows or columns. |

### `app/nodes/utilities/passthrough_node.py`

Workflow node implementation for passthrough node in the utilities family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `PassThroughNode` | class | PassThroughNode domain type. |

### `app/nodes/utilities/python_code_node.py`

Workflow node implementation for python code node in the utilities family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `PythonCodeNode` | class | PythonCodeNode domain type. |

### `app/nodes/visualization/__init__.py`

Package initialization for the IOTA ML app nodes visualization package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/nodes/visualization/barplot_node.py`

Workflow node implementation for barplot node in the visualization family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `BarPlotNode` | class | BarPlotNode domain type. |

### `app/nodes/visualization/boxplot_node.py`

Workflow node implementation for boxplot node in the visualization family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `BoxPlotNode` | class | BoxPlotNode domain type. |

### `app/nodes/visualization/clustering_plot_node.py`

Workflow node implementation for clustering plot node in the visualization family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ClusteringPlotNode` | class | ClusteringPlotNode domain type. |

### `app/nodes/visualization/histogram_node.py`

Workflow node implementation for histogram node in the visualization family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `HistogramNode` | class | HistogramNode domain type. |

### `app/nodes/visualization/pp_plot_node.py`

Workflow node implementation for pp plot node in the visualization family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `PPPlotNode` | class | PPPlotNode domain type. |

### `app/nodes/visualization/scatter_node.py`

Workflow node implementation for scatter node in the visualization family.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ScatterPlotNode` | class | ScatterPlotNode domain type. |

### `app/schemas.py`

IOTA ML backend application module for schemas.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ColumnInfo` | class | ColumnInfo domain type. |
| `DatasetOut` | class | DatasetOut domain type. |
| `WorkflowCreate` | class | WorkflowCreate domain type. |
| `WorkflowAutosaveIn` | class | WorkflowAutosaveIn domain type. |
| `WorkflowRenameIn` | class | WorkflowRenameIn domain type. |
| `WorkflowOut` | class | WorkflowOut domain type. |
| `WorkflowVersionCreate` | class | WorkflowVersionCreate domain type. |
| `WorkflowVersionOut` | class | WorkflowVersionOut domain type. |
| `WorkflowVersionSummaryOut` | class | WorkflowVersionSummaryOut domain type. |
| `RunCreate` | class | RunCreate domain type. |
| `RunOut` | class | RunOut domain type. |
| `RunSummaryOut` | class | RunSummaryOut domain type. |
| `ProjectBase` | class | ProjectBase domain type. |
| `ProjectCreate` | class | ProjectCreate domain type. |
| `ProjectUpdate` | class | ProjectUpdate domain type. |
| `ProjectOut` | class | ProjectOut domain type. |
| `LoginIn` | class | LoginIn domain type. |
| `UserProfile` | class | UserProfile domain type. |
| `UserProfileUpdate` | class | UserProfileUpdate domain type. |
| `LoginOut` | class | LoginOut domain type. |
| `CustomPortIn` | class | CustomPortIn domain type. |
| `CustomNodeCreate` | class | CustomNodeCreate domain type. |
| `CustomNodeOut` | class | CustomNodeOut domain type. |

### `app/services/__init__.py`

Package initialization for the IOTA ML app services package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/services/cache_service.py`

Application service for cache service.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ready()` | function | Implements ready. |

### `app/services/custom_nodes.py`

Application service for custom nodes.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `custom_node_to_api(node: CustomNode, *, include_code: bool=False)` | function | Implements custom node to api. |
| `list_custom_nodes(db: Session, owner_username: str)` | function | Implements list custom nodes. |
| `create_custom_node(db: Session, owner_username: str, payload: CustomNodeCreate)` | function | Implements create custom node. |
| `update_custom_node(db: Session, node: CustomNode, payload: CustomNodeCreate)` | function | Implements update custom node. |

### `app/services/jobs.py`

Application service for jobs.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `enqueue_run(run_id: int)` | function | Wake workers; PostgreSQL remains the authoritative queue. |
| `execute_run(run_id: int)` | function | Compatibility one-shot runner for tests and administrative use. |

### `app/services/metadata_service.py`

Application service for metadata service.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ready()` | function | Implements ready. |

### `app/services/node_cache.py`

Application service for node cache.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `prepare_cache_manifest(db: Session, run: Run, cache_dir: Path)` | function | Implements prepare cache manifest. |
| `persist_run_cache_records(db: Session, run: Run, records: list[dict[str, Any]])` | function | Implements persist run cache records. |
| `cleanup_node_cache(db: Session)` | function | Implements cleanup node cache. |
| `clear_project_cache(db: Session, *, owner_username: str, project_id: int \| None)` | function | Implements clear project cache. |

### `app/services/node_cache_keys.py`

Application service for node cache keys.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `canonical_json(value: Any)` | function | Implements canonical json. |
| `sha256_json(value: Any)` | function | Implements sha256 json. |
| `node_policy(node: dict[str, Any])` | function | Implements node policy. |
| `static_fingerprint(node: dict[str, Any])` | function | Implements static fingerprint. |
| `full_cache_key(*, static_key: str, resolved_params: dict[str, Any], upstream: list[dict[str, Any]], external_inputs: dict[str, Any], target_column: str \| None, task_type: str)` | function | Implements full cache key. |

### `app/services/node_cache_runtime.py`

Application service for node cache runtime.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `RuntimeNodeCache` | class | Child-process cache adapter. |

### `app/services/node_registry.py`

Application service for node registry.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `get_node_registry()` | function | Implements get node registry. |
| `get_node_map()` | function | Implements get node map. |
| `get_node_categories()` | function | Implements get node categories. |
| `get_node_definition(node_id: str)` | function | Implements get node definition. |
| `get_catalog_metadata()` | function | Implements get catalog metadata. |

### `app/services/preview_service.py`

Application service for preview service.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ready()` | function | Implements ready. |

### `app/services/run_queue.py`

Application service for run queue.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `retry_delay_seconds(attempts: int)` | function | Implements retry delay seconds. |
| `active_run_count(db: Session, *, owner_username: str \| None=None, project_id: int \| None=None)` | function | Implements active run count. |
| `enforce_run_quotas(db: Session, *, owner_username: str, project_id: int \| None)` | function | Implements enforce run quotas. |
| `find_idempotent_run(db: Session, *, owner_username: str, idempotency_key: str \| None)` | function | Implements find idempotent run. |
| `claim_next_run(db: Session, worker_id: str)` | function | Implements claim next run. |
| `request_cancel(db: Session, run: Run)` | function | Implements request cancel. |
| `queue_retry(db: Session, run: Run, *, reset_attempts: bool=False)` | function | Implements queue retry. |
| `fail_or_requeue(db: Session, run: Run, *, error: str, status: str='failed')` | function | Implements fail or requeue. |
| `recover_stale_runs(db: Session)` | function | Implements recover stale runs. |
| `queue_metrics(db: Session)` | function | Implements queue metrics. |

### `app/services/run_state.py`

Application service for run state.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `utcnow()` | function | Implements utcnow. |
| `log_entry(level: str, message: str, **context: Any)` | function | Implements log entry. |
| `append_log(existing: list[dict] \| None, level: str, message: str, **context: Any)` | function | Implements append log. |
| `initial_node_statuses(graph: dict[str, Any])` | function | Implements initial node statuses. |
| `progress_payload(graph: dict[str, Any], node_statuses: dict[str, dict[str, Any]] \| None=None)` | function | Implements progress payload. |
| `RunCancelledError` | class | RunCancelledError domain type. |

### `app/services/storage.py`

Application service for storage.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ensure_dirs()` | function | Implements ensure dirs. |
| `ensure_storage_writable()` | function | Fail startup early when the mounted runtime volume is not writable. |
| `dataset_path(filename: str)` | function | Implements dataset path. |
| `save_upload(file: UploadFile)` | async function | Implements save upload. |
| `read_csv(path: str, max_rows: int \| None=None)` | function | Implements read csv. |
| `column_info(df: pd.DataFrame)` | function | Implements column info. |
| `run_dir(run_id: int)` | function | Implements run dir. |

### `app/services/users.py`

Application service for users.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `user_file_path()` | function | Implements user file path. |
| `ensure_user_file()` | function | Implements ensure user file. |
| `load_users()` | function | Implements load users. |
| `save_users(users: list[dict[str, Any]])` | function | Implements save users. |
| `public_user(user: dict[str, Any])` | function | Implements public user. |
| `find_user(username: str)` | function | Implements find user. |
| `authenticate(username: str, password: str)` | function | Implements authenticate. |
| `issue_token(username: str)` | function | Implements issue token. |
| `verify_token(token: str)` | function | Implements verify token. |
| `get_current_user(credentials: HTTPAuthorizationCredentials \| None=Depends(security))` | function | Implements get current user. |
| `update_user_profile(username: str, payload: dict[str, Any])` | function | Implements update user profile. |

### `app/services/workflow_executor.py`

Application service for workflow executor.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ExecutionContext` | class | ExecutionContext domain type. |
| `columns_setting(value: Any)` | function | Implements columns setting. |
| `safe_json(value: Any)` | function | Implements safe json. |
| `node_params(node: dict[str, Any])` | function | Implements node params. |
| `registry_id(node: dict[str, Any])` | function | Implements registry id. |
| `node_label(node: dict[str, Any])` | function | Implements node label. |
| `chart_params(params: dict[str, Any])` | function | Implements chart params. |
| `parse_hidden_layers(value: Any)` | function | Implements parse hidden layers. |
| `table_output(title: str, df: pd.DataFrame, max_rows: int=100)` | function | Implements table output. |
| `metrics_output(title: str, metrics: dict[str, Any])` | function | Implements metrics output. |
| `json_output(title: str, value: Any)` | function | Implements json output. |
| `sample_to_output(title: str, sample: Any)` | function | Implements sample to output. |
| `pinned_node_output(node: dict[str, Any], label: str)` | function | Implements pinned node output. |
| `build_paths(graph: dict[str, Any])` | function | Implements build paths. |
| `demo_dataset(kind: str)` | function | Implements demo dataset. |
| `numeric_feature_columns(df: pd.DataFrame, target_column: str \| None)` | function | Implements numeric feature columns. |
| `feature_columns(df: pd.DataFrame, target_column: str \| None)` | function | Implements feature columns. |
| `apply_transform(df: pd.DataFrame, target_column: str \| None, node_id: str, params: dict[str, Any])` | function | Implements apply transform. |
| `load_context(path: list[dict[str, Any]], dataset_df: pd.DataFrame \| None, run_target: str \| None, task_type: str)` | function | Implements load context. |
| `infer_task_type(y: pd.Series, requested: str, model_id: str \| None=None)` | function | Implements infer task type. |
| `get_xy(df: pd.DataFrame, target_column: str \| None)` | function | Implements get xy. |
| `choose_score_func(name: str, task_type: str)` | function | Implements choose score func. |
| `clean_params(params: dict[str, Any])` | function | Implements clean params. |
| `build_model(model_id: str, params: dict[str, Any])` | function | Implements build model. |
| `build_preprocessor(X: pd.DataFrame)` | function | Implements build preprocessor. |
| `train_branch(context: ExecutionContext, model_node: dict[str, Any], path: list[dict[str, Any]], run_path: Path)` | function | Implements train branch. |
| `prediction_table(y_true: pd.Series, y_pred: np.ndarray, max_rows: int=500)` | function | Implements prediction table. |
| `compute_metrics(task_type: str, y_test: pd.Series, y_pred: np.ndarray, pipeline: Pipeline, X_test: pd.DataFrame)` | function | Implements compute metrics. |
| `analyze_dataframe(node_id: str, df: pd.DataFrame, target_column: str \| None, params: dict[str, Any])` | function | Implements analyze dataframe. |
| `analysis_to_output(title: str, node_id: str, analysis: Any, params: dict[str, Any] \| None=None)` | function | Implements analysis to output. |
| `transformed_feature_names(pipeline: Pipeline, fallback: list[str])` | function | Implements transformed feature names. |
| `analyze_model(node_id: str, pipeline: Pipeline, X_train: pd.DataFrame, X_test: pd.DataFrame, y_train: pd.Series, y_test: pd.Series, y_train_pred: np.ndarray, y_pred: np.ndarray, task_type: str, params: dict[str, Any], branch_result: dict[str, Any])` | function | Implements analyze model. |
| `model_analysis_to_output(title: str, node_id: str, analysis: Any, params: dict[str, Any] \| None=None)` | function | Implements model analysis to output. |
| `native_feature_importance(pipeline: Pipeline, fallback_features: list[str], top_n: int)` | function | Implements native feature importance. |
| `shap_summary(pipeline: Pipeline, X_test: pd.DataFrame, params: dict[str, Any])` | function | Implements shap summary. |
| `compare_branches(branches: list[dict[str, Any]])` | function | Implements compare branches. |
| `merge_node_outputs(target: dict[str, Any], outputs: dict[str, Any], path_index: int \| str \| None=None, source_label: str \| None=None, branch_label: str \| None=None)` | function | Implements merge node outputs. |
| `execute_workflow(graph: dict[str, Any], dataset_df: pd.DataFrame \| None, target_column: str \| None, task_type: str, run_path: Path, *, progress_callback: Callable[[str, str, str \| None], None] \| None=None, cancel_check: Callable[[], bool] \| None=None)` | function | Implements execute workflow. |

### `app/storage/__init__.py`

Package initialization for the IOTA ML app storage package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/storage/artifacts.py`

Persistent data and artifact storage support for artifacts.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/storage/datasets.py`

Persistent data and artifact storage support for datasets.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/storage/models.py`

Persistent data and artifact storage support for models.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/storage/results.py`

Persistent data and artifact storage support for results.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/workers/__init__.py`

Package initialization for the IOTA ML app workers package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/workers/reliable_worker.py`

Background execution worker support for reliable worker.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `WorkerWakeup` | class | Use Redis pub/sub for immediate queue wakeups with timed polling fallback. |
| `ForkedProcessAdapter` | class | Expose the subset of subprocess.Popen used by the worker. |
| `ActiveRun` | class | ActiveRun domain type. |
| `start_run(run_id: int, worker_id: str)` | function | Implements start run. |
| `finalize_active(active: ActiveRun, *, forced_status: str \| None=None, forced_error: str \| None=None)` | function | Implements finalize active. |
| `monitor_active(active: ActiveRun, worker_id: str)` | function | Implements monitor active. |
| `publish_worker_health(worker_id: str, active_count: int)` | function | Implements publish worker health. |
| `cleanup_old_runtime_directories()` | function | Implements cleanup old runtime directories. |
| `run_worker()` | function | Implements run worker. |
| `run_one(run_id: int)` | function | Implements run one. |

### `app/workers/run_child.py`

Background execution worker support for run child.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `execute(snapshot_path: Path, result_path: Path, progress_path: Path, cancel_path: Path)` | function | Implements execute. |
| `main()` | function | Implements main. |

### `app/workers/tasks.py`

Background execution worker support for tasks.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/workers/worker.py`

Background execution worker support for worker.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/workflow/__init__.py`

Package initialization for the IOTA ML app workflow package.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `app/workflow/component_runtime.py`

Workflow runtime support for component runtime.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `is_component_node(node: dict[str, Any])` | function | Implements is component node. |
| `component_snapshot(node: dict[str, Any])` | function | Implements component snapshot. |
| `component_ports(node: dict[str, Any], side: str)` | function | Implements component ports. |
| `component_settings(node: dict[str, Any])` | function | Implements component settings. |
| `execute_component(node: dict[str, Any], inputs: dict[str, Any], ctx: Any, resolved_component_params: dict[str, Any], *, apply_node: Callable[..., dict[str, Any]], runtime_cache: Any=None, progress_callback: Callable[..., None] \| None=None, cancel_check: Callable[[], bool] \| None=None)` | function | Implements execute component. |

### `app/workflow/errors.py`

Canonical workflow and node error contract.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `WorkflowProblem` | class | Serializable description of one actionable workflow failure. |
| `NodeContractError` | class | Expected, user-correctable violation of a node contract. |
| `normalize_node_exception(exc: Exception, *, node_id: str, node_name: str)` | function | Attach node context and classify expected versus unexpected failures. |

### `app/workflow/executor.py`

Topological workflow executor, cache integration, and output projection.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `get_params(node: dict[str, Any], ctx: RuntimeContext)` | function | Implements get params. |
| `registry_id(node: dict[str, Any])` | function | Implements registry id. |
| `apply_node(node: dict[str, Any], inputs: dict[str, Any], ctx: RuntimeContext, params: dict[str, Any] \| None=None, *, runtime_cache: RuntimeNodeCache \| None=None, progress_callback: ProgressCallback \| None=None, cancel_check: Callable[[], bool] \| None=None)` | function | Implements apply node. |
| `visible_node_output(node: dict[str, Any], value: Any)` | function | Implements visible node output. |
| `execute_scientific_workflow(graph: dict[str, Any], dataset_id: int \| None, target_column: str \| None, task_type: str, project_id: int \| None, execution_id: int \| str, *, dataset_path: str \| None=None, progress_callback: ProgressCallback \| None=None, cancel_check: Callable[[], bool] \| None=None, runtime_cache: RuntimeNodeCache \| None=None)` | function | Implements execute scientific workflow. |
| `is_legacy_graph(graph: dict[str, Any])` | function | Implements is legacy graph. |

### `app/workflow/expressions.py`

Workflow runtime support for expressions.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `ExpressionError` | class | ExpressionError domain type. |
| `resolve_reference(expr: str, context: dict[str, Any])` | function | Implements resolve reference. |
| `resolve_value(value: Any, context: dict[str, Any])` | function | Implements resolve value. |
| `resolve_settings(settings: dict[str, Any], context: dict[str, Any])` | function | Implements resolve settings. |

### `app/workflow/graph.py`

Workflow runtime support for graph.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `node_registry_id(node: dict[str, Any])` | function | Implements node registry id. |
| `topological_sort(nodes: list[dict[str, Any]], edges: list[dict[str, Any]])` | function | Implements topological sort. |
| `output_for_handle(value: Any, source_handle: str \| None)` | function | Implements output for handle. |
| `upstream_outputs(node_id: str, edges: list[dict[str, Any]], outputs: dict[str, Any])` | function | Implements upstream outputs. |

### `app/workflow/runtime_context.py`

Workflow runtime support for runtime context.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `RuntimeContext` | class | RuntimeContext domain type. |

### `app/workflow/scheduler.py`

Workflow runtime support for scheduler.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `affected_downstream_nodes(changed_node_id: str, edges: list[dict])` | function | Implements affected downstream nodes. |

### `app/workflow/types.py`

Validated API models for workflow graphs and validation diagnostics.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `WorkflowPort` | class | WorkflowPort domain type. |
| `WorkflowNode` | class | WorkflowNode domain type. |
| `WorkflowEdge` | class | WorkflowEdge domain type. |
| `WorkflowGraph` | class | WorkflowGraph domain type. |
| `ValidationMessage` | class | ValidationMessage domain type. |
| `ValidationResult` | class | ValidationResult domain type. |

### `app/workflow/validator.py`

Graph-level validation for nodes, settings, ports, connections, and cycles.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `compatible(source_type: str, target_type: str)` | function | Implements compatible. |
| `validate_workflow_graph(graph: dict[str, Any], component_interface: dict[str, Any] \| None=None, *, require_settings: bool=True, require_connections: bool=True)` | function | Implements validate workflow graph. |

### `scripts/backup_artifacts.py`

Administrative backend command for backup artifacts.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `main(target: str)` | function | Implements main. |

### `scripts/migrate_legacy_artifacts.py`

Move legacy dataset files from local disk into the configured artifact backend.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `main()` | function | Implements main. |

### `scripts/restore_artifacts.py`

Administrative backend command for restore artifacts.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `main(source: str)` | function | Implements main. |

### `tests/conftest.py`

Regression and contract tests for conftest.

Public API: none; this module provides declarations, registration, or import-time configuration.

### `tests/test_api_envelope.py`

Regression and contract tests for api envelope.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `make_app()` | function | Implements make app. |
| `test_success_response_is_enveloped()` | function | Implements test success response is enveloped. |
| `test_application_error_has_stable_contract()` | function | Implements test application error has stable contract. |

### `tests/test_artifact_storage.py`

Regression and contract tests for artifact storage.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `make_session(tmp_path: Path)` | function | Implements make session. |
| `test_local_artifact_round_trip_and_usage(tmp_path: Path)` | function | Implements test local artifact round trip and usage. |

### `tests/test_assistant_optional.py`

Regression and contract tests for assistant optional.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `test_assistant_does_not_require_credentials_during_startup()` | function | Implements test assistant does not require credentials during startup. |
| `test_assistant_accepts_injected_client_without_credentials()` | function | Implements test assistant accepts injected client without credentials. |

### `tests/test_code_node_sandbox.py`

Regression and contract tests for code node sandbox.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `test_python_code_node_runs_in_isolated_interpreter()` | function | Implements test python code node runs in isolated interpreter. |
| `test_python_code_node_blocks_network()` | function | Implements test python code node blocks network. |
| `test_python_code_node_timeout()` | function | Implements test python code node timeout. |

### `tests/test_components.py`

Regression and contract tests for components.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `make_session()` | function | Implements make session. |
| `component_payload(name: str='Reusable pass-through')` | function | Implements component payload. |
| `test_component_versions_are_immutable_and_registry_is_pinned()` | function | Implements test component versions are immutable and registry is pinned. |
| `test_component_usage_prevents_destructive_delete()` | function | Implements test component usage prevents destructive delete. |
| `test_component_export_import_round_trip()` | function | Implements test component export import round trip. |
| `test_component_executes_as_a_real_node_with_namespaced_internal_statuses()` | function | Implements test component executes as a real node with namespaced internal statuses. |
| `test_nested_component_package_includes_and_remaps_dependencies()` | function | Implements test nested component package includes and remaps dependencies. |
| `test_project_scoped_component_is_not_visible_in_another_project()` | function | Implements test project scoped component is not visible in another project. |

### `tests/test_dataframe_contract.py`

Regression and contract tests for dataframe contract.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `frame()` | function | Implements frame. |
| `test_payloads_share_one_lineage_source_without_eager_dataframe_copies()` | function | Implements test payloads share one lineage source without eager dataframe copies. |
| `test_contract_is_idempotent_and_applied_once_to_multi_output_results()` | function | Implements test contract is idempotent and applied once to multi output results. |
| `test_filtering_and_id_switch_preserve_explicit_row_alignment()` | function | Implements test filtering and id switch preserve explicit row alignment. |
| `test_sort_then_reset_uses_unique_id_values_instead_of_positional_guessing()` | function | Implements test sort then reset uses unique id values instead of positional guessing. |
| `test_aggregation_resets_lineage_intentionally()` | function | Implements test aggregation resets lineage intentionally. |
| `test_cache_round_trip_preserves_dataframe_contract(tmp_path)` | function | Implements test cache round trip preserves dataframe contract. |
| `test_lineage_copy_benchmark_is_constant_time_relative_to_source_size()` | function | Implements test lineage copy benchmark is constant time relative to source size. |

### `tests/test_dataframe_utility_nodes.py`

Regression tests for multi-frame combination and interactive table editing.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `test_vertical_combine_requires_matching_columns_by_default()` | function | Implements test vertical combine requires matching columns by default. |
| `test_horizontal_combine_aligns_all_inputs_by_unique_id()` | function | Implements test horizontal combine aligns all inputs by unique id. |
| `test_horizontal_position_alignment_rejects_different_lengths()` | function | Implements test horizontal position alignment rejects different lengths. |
| `test_interactive_table_applies_edits_and_selection_to_clean_output()` | function | Implements test interactive table applies edits and selection to clean output. |
| `test_interactive_table_added_rows_and_columns_are_deterministic()` | function | Implements test interactive table added rows and columns are deterministic. |

### `tests/test_domain_architecture.py`

Regression and contract tests for domain architecture.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `test_main_registers_domain_routers_directly()` | function | Implements test main registers domain routers directly. |
| `test_domain_packages_have_routes_and_boundaries()` | function | Implements test domain packages have routes and boundaries. |

### `tests/test_dual_dataframe_anomaly_nodes.py`

Regression and contract tests for dual dataframe anomaly nodes.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `test_zscore_uses_one_multiple_port_and_two_source_selectors()` | function | Implements test zscore uses one multiple port and two source selectors. |
| `test_zscore_calculates_on_one_dataframe_and_reports_the_other()` | function | Implements test zscore calculates on one dataframe and reports the other. |
| `test_zscore_rejects_an_unconnected_selection_immediately()` | function | Implements test zscore rejects an unconnected selection immediately. |

### `tests/test_migrations.py`

Regression and contract tests for migrations.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `alembic_config(database_url: str)` | function | Implements alembic config. |
| `test_fresh_database_reaches_head_with_model_table_parity(tmp_path, monkeypatch)` | function | Implements test fresh database reaches head with model table parity. |
| `test_legacy_database_migrates_without_losing_rows(tmp_path, monkeypatch)` | function | Implements test legacy database migrates without losing rows. |

### `tests/test_node_cache.py`

Regression and contract tests for node cache.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `test_canonical_json_and_cache_key_are_order_independent()` | function | Implements test canonical json and cache key are order independent. |
| `test_cache_key_changes_for_parameters_or_upstream_content(tmp_path: Path)` | function | Implements test cache key changes for parameters or upstream content. |
| `test_runtime_cache_round_trip_uses_verified_manifest(tmp_path: Path)` | function | Implements test runtime cache round trip uses verified manifest. |
| `test_persisted_cache_records_create_artifacts_lineage_and_reusable_manifest(tmp_path: Path)` | function | Implements test persisted cache records create artifacts lineage and reusable manifest. |

### `tests/test_node_registry.py`

Regression and contract tests for node registry.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `test_registry_integrity()` | function | Implements test registry integrity. |
| `test_all_aliases_resolve_to_registered_nodes()` | function | Implements test all aliases resolve to registered nodes. |
| `test_port_compatibility_is_complete()` | function | Implements test port compatibility is complete. |
| `test_requested_dataframe_nodes_are_in_the_live_catalog()` | function | Implements test requested dataframe nodes are in the live catalog. |
| `test_all_primary_anomaly_outputs_are_dataframe_tables()` | function | Implements test all primary anomaly outputs are dataframe tables. |
| `test_legacy_workflow_ids_validate_without_unsupported_node_errors()` | function | Implements test legacy workflow ids validate without unsupported node errors. |

### `tests/test_output_port_selection.py`

Regression and contract tests for output port selection.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `test_upstream_outputs_routes_only_selected_source_port()` | function | Implements test upstream outputs routes only selected source port. |
| `test_visible_outputs_are_annotated_by_source_port()` | function | Implements test visible outputs are annotated by source port. |
| `test_normalization_dataframe_port_is_not_confused_with_report_preview()` | function | Implements test normalization dataframe port is not confused with report preview. |

### `tests/test_run_queue.py`

Regression and contract tests for run queue.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `make_session()` | function | Implements make session. |
| `make_run(**overrides)` | function | Implements make run. |
| `test_atomic_claim_prevents_second_claim()` | function | Implements test atomic claim prevents second claim. |
| `test_cancel_queued_run_becomes_cancelled()` | function | Implements test cancel queued run becomes cancelled. |
| `test_failure_requeues_with_backoff_until_attempt_limit()` | function | Implements test failure requeues with backoff until attempt limit. |
| `test_stale_worker_run_is_recovered()` | function | Implements test stale worker run is recovered. |

### `tests/test_runtime_storage.py`

Regression and contract tests for runtime storage.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `test_runtime_storage_writability_probe_cleans_up(tmp_path, monkeypatch)` | function | Implements test runtime storage writability probe cleans up. |

### `tests/test_scientific_quality_nodes.py`

Regression and contract tests for scientific quality nodes.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `test_duplicate_sample_error_reads_xlsx_and_exposes_error_dataframe()` | function | Implements test duplicate sample error reads xlsx and exposes error dataframe. |
| `test_transposed_error_output_can_feed_row_series_bar_plot()` | function | Implements test transposed error output can feed row series bar plot. |
| `test_pp_plot_and_correlation_heatmap_produce_plot_outputs()` | function | Implements test pp plot and correlation heatmap produce plot outputs. |
| `test_clustering_plot_supports_columns_and_rows_with_compact_plot_payloads()` | function | Implements test clustering plot supports columns and rows with compact plot payloads. |
| `test_sorted_gap_outlier_caps_abrupt_upper_tail_and_adds_flags()` | function | Implements test sorted gap outlier caps abrupt upper tail and adds flags. |
| `test_transpose_dataframe_uses_selected_row_labels_as_columns()` | function | Implements test transpose dataframe uses selected row labels as columns. |
| `test_new_nodes_are_available_in_registry()` | function | Implements test new nodes are available in registry. |
| `test_workflow_id_is_preserved_outside_calculation_columns_and_can_change_from_source_columns()` | function | Implements test workflow id is preserved outside calculation columns and can change from source columns. |
| `test_duplicate_error_defaults_to_inherited_workflow_id()` | function | Implements test duplicate error defaults to inherited workflow id. |
| `test_legacy_calculation_settings_cannot_modify_workflow_id()` | function | Implements test legacy calculation settings cannot modify workflow id. |
| `test_inspection_reports_exclude_id_from_calculations()` | function | Implements test inspection reports exclude id from calculations. |

### `tests/test_workflow_error_contract.py`

Tests for user-owned versus application-owned workflow failures.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `test_node_contract_error_preserves_actionable_context()` | function | Implements test node contract error preserves actionable context. |
| `test_unexpected_type_error_is_owned_by_application()` | function | Implements test unexpected type error is owned by application. |

### `tests/test_workflow_versions.py`

Regression and contract tests for workflow versions.

| Symbol | Kind | Contract |
| --- | --- | --- |
| `make_session()` | function | Implements make session. |
| `test_autosave_is_noop_for_identical_draft_and_revises_changed_graph()` | function | Implements test autosave is noop for identical draft and revises changed graph. |
| `test_autosave_accepts_missing_node_settings_but_run_validation_rejects_them()` | function | Implements test autosave accepts missing node settings but run validation rejects them. |
| `test_run_validation_rejects_a_node_without_its_required_input_connection()` | function | Implements test run validation rejects a node without its required input connection. |
| `test_named_versions_are_immutable_snapshots_and_can_be_restored()` | function | Implements test named versions are immutable snapshots and can be restored. |
| `test_workflow_can_be_renamed_and_deleted_without_removing_run_history()` | function | Implements test workflow can be renamed and deleted without removing run history. |

### `worker.py`

IOTA ML backend implementation for worker.

Public API: none; this module provides declarations, registration, or import-time configuration.

