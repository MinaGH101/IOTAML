# Graph Report - iota_ml  (2026-10-09)

## Corpus Check
- 726 files · ~314,570 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 70 file(s) not represented in the graph (top: .css 49, (none) 9, .example 4)

## Summary
- 4564 nodes · 14750 edges · 203 communities (135 shown, 68 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 889 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cc7cf885`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Run
- components/routes.py
- registry/__init__.py
- DualDataAnomalyDetector
- dataframe_result
- executor.py
- Project
- Any
- ProjectFields.tsx
- runtimeContext.ts
- model_nodes.py
- test_review_nodes.py
- BoardPage.tsx
- react
- useCanvasNodeActions.ts
- sorted_gap_node.py
- ParamComplexField.tsx
- ui/index.ts
- User
- duplicate_error_node.py
- NodePalette.tsx
- AdminPage.tsx
- ai.py
- userFriendlyErrorMessage
- lucide-react
- components/ResultsPanel.tsx
- useWorkflowEditorRuntime.ts
- App.tsx
- useProjectDetailController.ts
- test_node_cache.py
- RightPanel.tsx
- nodes/routes.py
- MinioStorageBackend
- utcnow
- config.py
- workflows/routes.py
- datasets/routes.py
- Module inventory
- artifacts/routes.py
- types/index.ts
- review/nodes.py
- artifacts/service.py
- workflow_actions.py
- AmChartsRenderer.tsx
- workflowGraphStore.ts
- python_code_node.py
- normalization_node.py
- AssistantService
- .run
- ref_node_assert
- columnParameterPropagation.ts
- WorkflowRepository
- ThemeProvider.tsx
- safe_json
- test_scientific_quality_nodes.py
- generate.py
- validate_workflow_graph
- ForkedProcessAdapter
- runs/routes.py
- pandas
- assistant/service.py
- json
- reliable_worker.py
- workflow_advisor.py
- test_workflow_versions.py
- ReviewOutput.tsx
- http.py
- serverQuery.tsx
- drawDendrogram.ts
- board.ts
- Output
- filter_dataframe_node.py
- tools.py
- ProjectDetailPage.tsx
- compilerOptions
- run_child.py
- maintenance.py
- useWorkflowComponents.ts
- LocalStorageBackend
- check-theme-contract.mjs
- main.py
- get_db
- get_settings
- OutputTable.tsx
- observerPool.ts
- scripts
- run_worker
- ProjectManagementPage.tsx
- NodeContractError
- enforce_locked_graph_changes
- package.json
- dedupe-css.mjs
- run-tests.mjs
- 20260731_0006_backend_reconstruction.py
- workflow_tools.py
- check-feature-boundaries.mjs
- Backend Reconstruction Report
- NodeDefinition
- app_guide.py
- outputSnapshot.ts
- IOTA ML Backend Architecture
- 20260712_0001_reliable_run_queue.py
- test_run_queue.py
- merge_successful_run_state
- devDependencies
- authTokenStorage
- WorkflowHeader.tsx
- 20260724_0005_schema_convergence.py
- contracts/types.py
- IOTA ML
- Backend API compatibility
- check-css-debt.mjs
- rate_limit.py
- dependencies
- node-test.d.ts
- `alembic/env.py`
- Cubes.tsx
- 20260712_0002_artifact_storage_and_domains.py
- Reusable review workflows in IOTA ML
- Workflow
- ResizeObserverStub
- Any
- test_work_tasks.py
- README.md
- Frontend API Compatibility
- backup.sh
- restore.sh
- vitest.config.ts
- package-release.sh
- scan-secrets.sh
- ComponentRepository
- Database Migration Guide
- Backend Operations
- Artifact Cache, Lineage, Autosave, and Workflow Versions
- notifications.py
- Frontend rebuild report
- ZScoreOutlierNode
- nodes/repository.py
- types
- expressions.py
- Reliable training and data imports
- Reusable workflow components
- 20260716_0003_node_cache_and_workflow_versions.py
- hash_password.py
- IOTA ML frontend architecture
- Performance model and budgets
- State model
- Authentication and Authorization
- amCharts rendering architecture
- test_domain_architecture.py
- Multi-case review workflow
- Dataframe utility nodes
- Graphify-assisted navigation
- IOTA ML Backend Code Reference
- domains/README.md
- DATAFRAME_CONTRACT.md
- auth/README.md
- styles/README.md

## God Nodes (most connected - your core abstractions)
1. `Module inventory` - 211 edges
2. `User` - 190 edges
3. `react` - 156 edges
4. `BaseNode` - 123 edges
5. `get_settings()` - 120 edges
6. `dataframe_result()` - 106 edges
7. `node_label()` - 98 edges
8. `Run` - 96 edges
9. `lucide-react` - 82 edges
10. `dataframe_payload()` - 81 edges

## Surprising Connections (you probably didn't know these)
- `Execution model` --references--> `NodeExecution`  [INFERRED]
  docs/ARTIFACT_CACHE_AND_VERSIONING.md → backend/app/domains/artifacts/models.py
- `Node execution records` --references--> `NodeExecution`  [INFERRED]
  docs/ARTIFACT_CACHE_AND_VERSIONING.md → backend/app/domains/artifacts/models.py
- `Artifact metadata and lineage` --references--> `artifact_lineage()`  [INFERRED]
  docs/ARTIFACT_CACHE_AND_VERSIONING.md → backend/app/domains/artifacts/routes.py
- `Product model` --references--> `history()`  [INFERRED]
  docs/REVIEW_WORKFLOW_IMPLEMENTATION_PLAN.md → backend/app/domains/assistant/router.py
- `Product model` --references--> `metrics()`  [INFERRED]
  docs/REVIEW_WORKFLOW_IMPLEMENTATION_PLAN.md → backend/app/main.py

## Import Cycles
- None detected.

## Communities (203 total, 68 thin omitted)

### Community 0 - "Run"
Cohesion: 0.04
Nodes (52): downgrade(), upgrade(), _columns(), _indexes(), upgrade(), upgrade(), upgrade(), upgrade() (+44 more)

### Community 1 - "components/routes.py"
Cohesion: 0.08
Nodes (71): ConflictError, NotFoundError, WorkflowComponent, WorkflowComponentVersion, _component_context(), create(), _create_owner(), export() (+63 more)

### Community 2 - "registry/__init__.py"
Cohesion: 0.04
Nodes (50): selected_input_dataframe(), IQROutlierNode, anomaly_display_outputs(), anomaly_node_response(), _selected_columns(), ThresholdAnomalyNode, BaseNode, port() (+42 more)

### Community 3 - "DualDataAnomalyDetector"
Cohesion: 0.05
Nodes (19): AnomalyDetection, AnomalyResult, canonical_column_name(), ColumnPair, DualDataAnomalyDetector, _number_label(), _slug(), DualDataAnomalyDetectorTests (+11 more)

### Community 4 - "dataframe_result"
Cohesion: 0.05
Nodes (47): normalize_text(), parse_persian_date(), PersianValuesNode, convert(), SelectColumnsNode, apply_dataframe_contract(), calculation_columns(), calculation_df() (+39 more)

### Community 5 - "executor.py"
Cohesion: 0.09
Nodes (20): RunCancelledError, _annotate_dataframe_contract(), _annotate_port_output(), apply_node(), execute_workflow(), get_params(), _output_kind_matches_port(), _port_candidates() (+12 more)

### Community 6 - "Project"
Cohesion: 0.11
Nodes (38): normalize_role(), permission_for_project(), Project, ProjectAssignment, ProjectRepository, acknowledge(), assignable_users(), create() (+30 more)

### Community 7 - "Any"
Cohesion: 0.26
Nodes (10): all_dataframe_payloads(), all_upstream_dfs(), _candidate_inputs(), first_json_payload(), first_model(), first_model_payload(), first_upstream_id_column(), materialize_dataset_path() (+2 more)

### Community 8 - "ProjectFields.tsx"
Cohesion: 0.11
Nodes (24): AssignmentEditor(), AssignmentPicker(), pickerLabel(), PickerOption(), Props, AssignmentMode, PRIORITY_OPTIONS, roleLabel() (+16 more)

### Community 9 - "runtimeContext.ts"
Cohesion: 0.09
Nodes (39): Execution, runsApi, pollingDelay(), createRunProgressTransport(), RunProgressTransport, RunProgressTransportOptions, RunProgressTransportState, Run (+31 more)

### Community 10 - "model_nodes.py"
Cohesion: 0.05
Nodes (42): metrics_output(), _candidate_inputs(), collect_data_pairs(), _is_classification(), MetricsSummaryNode, _pairs_from_item(), PredictionPreviewNode, _safe_metric() (+34 more)

### Community 11 - "test_review_nodes.py"
Cohesion: 0.15
Nodes (37): AIReviewNode, AssignReviewNode, CaseIntakeNode, CaseValidationNode, DecisionNode, LoadReviewResponsesNode, RecordReviewNode, ReviewFormNode (+29 more)

### Community 12 - "BoardPage.tsx"
Cohesion: 0.09
Nodes (39): BoardViewport, getBoardOutputDrag(), BoardPage(), objectValue(), Props, FocusedOutputModal(), BoardCard, FocusedOutput (+31 more)

### Community 13 - "react"
Cohesion: 0.08
Nodes (48): AutosaveWorkflowPayload, workflowsApi, ApiError, cleanFilename(), exportWorkflowJson(), PortableWorkflow, NodeCatalogResponse, Workflow (+40 more)

### Community 14 - "useCanvasNodeActions.ts"
Cohesion: 0.14
Nodes (18): makeNode(), paramsFromRegistry(), PinnedNodeData, renameWorkflowNode(), nodes, updateNodeData(), updateNodeParameters(), updateNodePinnedOutput() (+10 more)

### Community 15 - "sorted_gap_node.py"
Cohesion: 0.11
Nodes (11): _replacement_value(), _robust_gap_threshold(), _tail_cut(), TailResult, _clean_numeric(), _condition_mask(), DetectionLimitHandlingNode, _replacement() (+3 more)

### Community 16 - "ParamComplexField.tsx"
Cohesion: 0.05
Nodes (72): Dot, DotGrid(), DotGridProps, hexToRgb(), throttle(), ArtifactFile, ArtifactFilesInput(), Assignee (+64 more)

### Community 17 - "ui/index.ts"
Cohesion: 0.12
Nodes (31): ButtonProps, ButtonSize, ButtonVariant, IconButtonProps, ConfirmDialog(), ConfirmDialogProps, Dialog(), DialogProps (+23 more)

### Community 18 - "User"
Cohesion: 0.07
Nodes (44): create_managed_user(), delete_user(), get_managed_user(), list_users(), update_user(), _user_out(), User, UserRepository (+36 more)

### Community 19 - "duplicate_error_node.py"
Cohesion: 0.14
Nodes (9): _aggregate_metric(), _bounded_mae_pct(), _clean_id(), _numeric(), _resolve_mapping_columns(), _safe_corr(), _decode_data_url(), _read_delimited() (+1 more)

### Community 20 - "NodePalette.tsx"
Cohesion: 0.13
Nodes (28): NodeDialogHeader(), RunNodeStatus, Inspector(), InspectorBody(), InspectorProps, CollapsedPalette(), categoryClassName(), categoryIcon() (+20 more)

### Community 21 - "AdminPage.tsx"
Cohesion: 0.08
Nodes (22): AdminPage(), emptyDraft, roleLabel(), adminApi, AdminUserDetail, AdminUserProject, useTheme(), LoginPage() (+14 more)

### Community 22 - "ai.py"
Cohesion: 0.12
Nodes (8): ask_json(), ocr_pdf(), _parse_json_object(), _Response, test_ask_json_retries_empty_content_and_accepts_wrapped_json(), test_ocr_pdf_retries_rate_limit_without_restarting_the_node(), test_ocr_pdf_uses_the_dedicated_provider_endpoint(), fake_urlopen()

### Community 23 - "userFriendlyErrorMessage"
Cohesion: 0.06
Nodes (62): componentsApi, ApiEnvelope, jsonHeaders, projectQuery(), RequestOptions, unauthorizedListeners, API_ERROR_MESSAGES, containsPersianText() (+54 more)

### Community 24 - "lucide-react"
Cohesion: 0.09
Nodes (29): InteractiveTableGrid(), InteractiveTableToolbar(), ReturnTypeOfInteractiveTable, useInteractiveTableOutput(), SelectionToggleButton(), InteractiveTableRuntimeContext, useInteractiveTableRuntime(), applyInteractiveTableState() (+21 more)

### Community 25 - "components/ResultsPanel.tsx"
Cohesion: 0.09
Nodes (40): displayTitle(), OutputCard, outputTypeLabel(), Props, OutputCards, SharedProps, TabbedOutputCard, OutputErrorBoundary (+32 more)

### Community 26 - "useWorkflowEditorRuntime.ts"
Cohesion: 0.17
Nodes (21): workflowOutputSignature(), createAutosaveSignature(), createAutosaveSnapshot(), base, WorkflowPageProps, EMPTY_CATALOG, useWorkflowEditorBase(), WorkflowEditorBase (+13 more)

### Community 27 - "App.tsx"
Cohesion: 0.14
Nodes (24): AdminPage, App(), CreateProjectPage, LoadingPage(), LoginPage, ProfilePage, ProjectDetailPage, ProjectManagementPage (+16 more)

### Community 28 - "useProjectDetailController.ts"
Cohesion: 0.16
Nodes (24): projectsApi, useAssignableUsers(), fetchProjectAssets(), invalidateProjectCaches(), emptyWorkflowGraph(), importWorkflowFile(), State, useCreateProjectActions() (+16 more)

### Community 29 - "test_node_cache.py"
Cohesion: 0.12
Nodes (23): canonical_node_id(), get_node_runner(), canonical_json(), full_cache_key(), _jsonable(), node_policy(), referenced_artifact_ids(), sha256_json() (+15 more)

### Community 30 - "RightPanel.tsx"
Cohesion: 0.09
Nodes (31): assistantApi, AssistantChatResponse, AssistantHistoryMessage, formatDateTime(), ASSISTANT_ERROR_MESSAGE, runDuration(), AssistantMessageContent(), renderInlineMarkdown() (+23 more)

### Community 31 - "nodes/routes.py"
Cohesion: 0.13
Nodes (28): CustomNode, _catalog_owner(), create_user_node(), delete_user_node(), get_catalog(), get_node(), get_user_node(), list_categories() (+20 more)

### Community 32 - "MinioStorageBackend"
Cohesion: 0.10
Nodes (3): _MinioReader, MinioStorageBackend, `app/infrastructure/storage/minio_backend.py`

### Community 33 - "utcnow"
Cohesion: 0.21
Nodes (15): retry_run(), active_run_count(), classify_failure(), enforce_run_quotas(), fail_or_requeue(), find_idempotent_run(), queue_metrics(), queue_retry() (+7 more)

### Community 35 - "workflows/routes.py"
Cohesion: 0.11
Nodes (25): autosave(), create(), get_one(), list_all(), remove(), remove_version(), rename(), restore() (+17 more)

### Community 36 - "datasets/routes.py"
Cohesion: 0.09
Nodes (20): Dataset, DatasetRepository, _dataset_and_owner(), delete_dataset_route(), list_datasets(), preview_dataset(), sql_import_route(), upload_dataset_route() (+12 more)

### Community 37 - "Module inventory"
Cohesion: 0.01
Nodes (148): `alembic/versions/20260712_0001_reliable_run_queue.py`, `alembic/versions/20260712_0002_artifact_storage_and_domains.py`, `alembic/versions/20260716_0003_node_cache_and_workflow_versions.py`, `alembic/versions/20260716_0004_reusable_workflow_components.py`, `alembic/versions/20260724_0005_schema_convergence.py`, `app/api/__init__.py`, `app/api/routes_auth.py`, `app/api/routes_datasets.py` (+140 more)

### Community 38 - "artifacts/routes.py"
Cohesion: 0.08
Nodes (37): Artifact, ArtifactLineage, NodeCacheEntry, NodeExecution, ArtifactRepository, _artifact_and_owner(), artifact_lineage(), artifact_usage() (+29 more)

### Community 39 - "types/index.ts"
Cohesion: 0.06
Nodes (46): nodesApi, InputGroup, NodeInputsPanel(), Props, NodeOutputsPanel(), NodeSettingsPanel(), PARAM_TRANSLATIONS, translateParamText() (+38 more)

### Community 40 - "review/nodes.py"
Cohesion: 0.20
Nodes (18): input_by_port(), case_batch_result(), case_result(), cases_from_batch(), invalid(), make_case(), parse_object(), require_case() (+10 more)

### Community 41 - "artifacts/service.py"
Cohesion: 0.08
Nodes (27): AppError, PermissionDeniedError, QuotaExceededError, StorageUnavailableError, ValidationAppError, ArtifactQuotaReservation, _copy_and_hash(), create_artifact_from_path() (+19 more)

### Community 42 - "workflow_actions.py"
Cohesion: 0.17
Nodes (28): _add_edge(), _add_node(), apply_workflow_actions(), apply_workflow_actions_to_graph(), _as_dict(), _as_list(), _best_port_pair(), _default_params() (+20 more)

### Community 43 - "AmChartsRenderer.tsx"
Cohesion: 0.22
Nodes (31): chartRegistry, RenderChart, addAxisLabel(), addCircleBullets(), addCursor(), addLegend(), addValueRange(), amChartsLicenseKey (+23 more)

### Community 44 - "workflowGraphStore.ts"
Cohesion: 0.10
Nodes (24): createWorkflowGraphStore(), initialState, resolve(), WorkflowGraphActions, WorkflowGraphState, WorkflowGraphStore, sameStringArray(), AtomicStore (+16 more)

### Community 45 - "python_code_node.py"
Cohesion: 0.12
Nodes (13): _as_dataframe(), _collect_inputs(), CustomPythonNode, _input_value(), _run_custom_code(), _run_code(), _validate_code(), `tests/test_code_node_sandbox.py` (+5 more)

### Community 46 - "normalization_node.py"
Cohesion: 0.14
Nodes (13): _blocks(), _cols(), NormalizationNode, _positive(), PPPlotNode, _dataframe_columns_for_port(), _port_value(), visible_node_output() (+5 more)

### Community 47 - "AssistantService"
Cohesion: 0.10
Nodes (14): AssistantChatResult, AssistantNotConfiguredError, AssistantProviderError, AssistantService, `app/domains/assistant/service.py`, `tests/test_assistant_optional.py`, test_assistant_accepts_injected_client_without_credentials(), test_assistant_defaults_to_openai_base_url() (+6 more)

### Community 48 - ".run"
Cohesion: 0.23
Nodes (4): _bounded_context_value(), _contexts_for_case(), _dynamic_form_from(), _dynamic_forms_from()

### Community 49 - "ref_node_assert"
Cohesion: 0.09
Nodes (20): dataset, edges, nodes, edges, nodes, WorkflowViewport, loadCanvasViewport(), normalizeCanvasViewport() (+12 more)

### Community 50 - "columnParameterPropagation.ts"
Cohesion: 0.12
Nodes (29): EMPTY_ALIASES, EMPTY_PORT_COMPATIBILITY, PortCompatibilityMap, portTypeFor(), registryForFlowNode(), ColumnContext, createColumnContextResolver(), DATAFRAME_PORT_TYPES (+21 more)

### Community 52 - "ThemeProvider.tsx"
Cohesion: 0.14
Nodes (14): applyTheme(), AppTheme, persistTheme(), readStoredTheme(), THEME_STORAGE_KEY, AppErrorBoundary, Props, State (+6 more)

### Community 53 - "safe_json"
Cohesion: 0.06
Nodes (14): _blocks(), _cols(), _constant_value(), ImputationNode, _aligned_row_keys(), normalize(), inherit_dataframe_contract(), safe_json() (+6 more)

### Community 54 - "test_scientific_quality_nodes.py"
Cohesion: 0.09
Nodes (28): SortedGapOutlierNode, DataOverviewNode, DuplicateSampleErrorNode, MissingValuesReportNode, StatisticalReportNode, BarPlotNode, _boolean_setting(), ClusteringPlotNode (+20 more)

### Community 55 - "generate.py"
Cohesion: 0.17
Nodes (15): build_catalog(), main(), _matches_default(), render_catalog(), all_node_runners(), validate_registry_integrity(), `tests/test_node_registry.py`, test_catalog_contains_only_versioned_unique_nodes() (+7 more)

### Community 56 - "validate_workflow_graph"
Cohesion: 0.16
Nodes (23): component_ports(), component_settings(), component_snapshot(), _digest(), execute_component(), is_component_node(), _namespace_graph(), node_registry_id() (+15 more)

### Community 58 - "runs/routes.py"
Cohesion: 0.07
Nodes (29): run_current_workflow(), get_case(), import_cases(), list_cases(), response_options(), run_cases(), _serialize(), StartCasesRequest (+21 more)

### Community 59 - "pandas"
Cohesion: 0.07
Nodes (22): _json_value(), _normalise_id(), _numeric_columns(), _numeric_json_value(), _group_label(), _metric_value(), _parse_list(), _coerce_cell_value() (+14 more)

### Community 60 - "assistant/service.py"
Cohesion: 0.12
Nodes (9): configure_logging(), JsonFormatter, _redact(), get_context(), backend_snapshot(), config_snapshot(), file_digest(), main() (+1 more)

### Community 61 - "json"
Cohesion: 0.16
Nodes (19): main(), node(), call(), edge(), ensure_project(), ensure_users(), ensure_workflow(), main() (+11 more)

### Community 62 - "reliable_worker.py"
Cohesion: 0.19
Nodes (15): ActiveRun, _child_environment(), finalize_active(), monitor_active(), _read_json(), _read_tail(), _resource_limiter(), _run_forked_child() (+7 more)

### Community 63 - "workflow_advisor.py"
Cohesion: 0.16
Nodes (15): _action_plan(), advise_workflow(), _annotate_step_with_workflow(), _connection_advice(), _display_name(), _first_node_choice(), get_workflow_patterns(), _model_performance_profile() (+7 more)

### Community 64 - "test_workflow_versions.py"
Cohesion: 0.12
Nodes (24): WorkflowAutosaveIn, WorkflowCreate, WorkflowOut, WorkflowRenameIn, WorkflowVersionCreate, WorkflowVersionOut, WorkflowVersionSummaryOut, autosave_workflow() (+16 more)

### Community 65 - "ReviewOutput.tsx"
Cohesion: 0.15
Nodes (29): errorText(), Field, ReviewFormOutput(), Task, AIReviewRadar(), AIReviewView(), asList(), asRecord() (+21 more)

### Community 66 - "http.py"
Cohesion: 0.10
Nodes (13): _http_error_code(), install_exception_handlers(), handle_app_error(), handle_http_error(), handle_unexpected_error(), handle_validation_error(), bind_context(), get_request_id() (+5 more)

### Community 67 - "serverQuery.tsx"
Cohesion: 0.17
Nodes (18): AuthContext, AuthContextValue, AuthProvider(), clearAuthToken(), onUnauthorized(), cache, CacheEntry, clearServerQueryCache() (+10 more)

### Community 68 - "drawDendrogram.ts"
Cohesion: 0.22
Nodes (15): drawBranches(), drawDendrogram(), drawGrid(), drawLabels(), colorIndex(), createGeometry(), finite(), BRANCH_COLOR_VARIABLES (+7 more)

### Community 69 - "board.ts"
Cohesion: 0.10
Nodes (36): Results and outputs, createOutputReference(), optionalNumber(), optionalString(), OutputReference, restoreOutputReference(), ANALYSIS_BOARD_ZOOM_MAX, ANALYSIS_BOARD_ZOOM_MIN (+28 more)

### Community 70 - "Output"
Cohesion: 0.20
Nodes (14): AmChartsRenderer, AmChartsRendererProps, AmChartsOutput, ChartLoadingPlaceholder(), ChartOutput(), DendrogramOutput, chartHeight(), getThemeSnapshot() (+6 more)

### Community 71 - "filter_dataframe_node.py"
Cohesion: 0.12
Nodes (16): _check_condition(), _check_group(), _check_rule(), _coerce_value(), FilterDataFrameNode, _parse_conditions(), _series_filter(), _as_columns() (+8 more)

### Community 72 - "tools.py"
Cohesion: 0.16
Nodes (11): get_full_catalog(), get_node_details(), list_node_summaries(), execute_app_guide_tool(), execute_catalog_tool(), execute_workflow_advisor_tool(), all_nodes_api(), catalog_metadata() (+3 more)

### Community 73 - "ProjectDetailPage.tsx"
Cohesion: 0.10
Nodes (31): DatasetRow(), DatasetUploader(), ProjectMessage(), SqlImporter(), WorkflowCard(), WorkflowIcon(), BYTE_UNITS, formatBytes() (+23 more)

### Community 74 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx (+11 more)

### Community 75 - "run_child.py"
Cohesion: 0.17
Nodes (11): _atomic_write(), _disable_network(), blocked(), connect(), connect_ex(), execute(), progress_callback(), save_progress() (+3 more)

### Community 76 - "maintenance.py"
Cohesion: 0.25
Nodes (9): cleanup_expired_artifacts(), cache_job(), dead_letter_job(), logs_job(), main(), maintenance_lock(), run_command(), stale_run_job() (+1 more)

### Community 77 - "useWorkflowComponents.ts"
Cohesion: 0.10
Nodes (25): ExposedParameters(), InterfaceRows(), reorder(), TYPES, safeParameterId(), useExposedParameters(), ComponentDefinitionEditorDialog(), Props (+17 more)

### Community 79 - "check-theme-contract.mjs"
Cohesion: 0.11
Nodes (17): componentCssFiles, cssFiles, definedVariables, failures, legacyExact, legacyPrefixes, root, runtimeVariables (+9 more)

### Community 80 - "main.py"
Cohesion: 0.10
Nodes (15): _error_schema(), install_openapi(), custom_openapi(), _success_schema(), render_prometheus(), ensure_dirs(), ensure_storage_writable(), legacy_health() (+7 more)

### Community 81 - "get_db"
Cohesion: 0.23
Nodes (9): create_session_factory(), get_db(), transactional_session(), Notification, list_notifications(), mark_all_notifications_read(), mark_notification_read(), _serialize() (+1 more)

### Community 82 - "get_settings"
Cohesion: 0.12
Nodes (15): get_settings(), Settings, create_database_engine(), ingest_run_artifact_paths(), convert(), path_candidate(), sql_sources(), available_sources() (+7 more)

### Community 83 - "OutputTable.tsx"
Cohesion: 0.29
Nodes (12): compareValues(), formatCell(), initialPageSize(), nextSort(), PAGE_SIZES, Row, SortState, OutputTableFooter() (+4 more)

### Community 84 - "observerPool.ts"
Cohesion: 0.15
Nodes (16): useChartVisibility(), useOutputVisibility(), getPool(), Listener, observeVisibility(), Pool, pools, publish() (+8 more)

### Community 85 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, build, check, check:architecture, check:css-debt, check:theme, css:dedupe, dev (+8 more)

### Community 86 - "run_worker"
Cohesion: 0.16
Nodes (6): cleanup_old_runtime_directories(), _preload_execution_runtime(), publish_worker_health(), run_worker(), WorkerWakeup, `app/workers/reliable_worker.py`

### Community 87 - "ProjectManagementPage.tsx"
Cohesion: 0.20
Nodes (12): ProjectPriorityBadge(), ProjectStatus(), ProjectCard(), ProjectFiltersBar(), ProjectSection(), useProjectsList(), AccessFilter, accessLabel() (+4 more)

### Community 88 - "NodeContractError"
Cohesion: 0.08
Nodes (14): column(), valid(), _duplicates(), NodeContractError, normalize_node_exception(), WorkflowProblem, `tests/test_workflow_error_contract.py`, test_node_contract_error_preserves_actionable_context() (+6 more)

### Community 89 - "enforce_locked_graph_changes"
Cohesion: 0.29
Nodes (10): _boards(), enforce_locked_execution(), enforce_locked_graph_changes(), node_is_locked(), _nodes(), _graph(), test_editor_can_change_unlocked_resources(), test_editor_cannot_change_locked_resources() (+2 more)

### Community 90 - "package.json"
Cohesion: 0.14
Nodes (11): name, private, type, version, @playwright/test, stylelint, @types/react, @types/react-dom (+3 more)

### Community 91 - "dedupe-css.mjs"
Cohesion: 0.20
Nodes (11): entryCss, importedResult, orderedFiles, processGroup(), result, root, scopeKey(), standalone (+3 more)

### Community 92 - "run-tests.mjs"
Cohesion: 0.17
Nodes (8): failures, root, src, walk(), result, root, tests, walk()

### Community 93 - "20260731_0006_backend_reconstruction.py"
Cohesion: 0.29
Nodes (8): _add_columns(), _add_indexes(), _columns(), downgrade(), _indexes(), _postgres_fk(), _tables(), upgrade()

### Community 94 - "workflow_tools.py"
Cohesion: 0.26
Nodes (7): _compact(), get_workflow_context(), _ports_for_context(), validate_workflow_context(), validate_graph(), _get_custom_record(), get_node()

### Community 95 - "check-feature-boundaries.mjs"
Cohesion: 0.18
Nodes (6): errors, frontendRoot, requiredDirectories, retiredPaths, sourceFiles(), sourceRoot

### Community 96 - "Backend Reconstruction Report"
Cohesion: 0.11
Nodes (17): Architecture changes, Artifact and worker recovery, Backend Reconstruction Report, Database and API hardening, Database inventory, Deployment validation status, Established canonical modules, Known limitations (+9 more)

### Community 98 - "app_guide.py"
Cohesion: 0.36
Nodes (3): get_app_guide(), search_app_guide(), _tokens()

### Community 99 - "outputSnapshot.ts"
Cohesion: 0.22
Nodes (9): arrayLimit(), boundedValue(), LIMITS, MATRIX_ARRAY_KEYS, PLOT_ARRAY_KEYS, POINT_ARRAY_KEYS, ROW_ARRAY_KEYS, SERIES_ARRAY_KEYS (+1 more)

### Community 100 - "IOTA ML Backend Architecture"
Cohesion: 0.08
Nodes (24): ApiEnvelopeMiddleware, Artifact lifecycle, Cache flow, Canonical workflow pipeline, Connection budget, Database foundation, Dataframe and ID-column contract, Domain ownership (+16 more)

### Community 101 - "20260712_0001_reliable_run_queue.py"
Cohesion: 0.39
Nodes (6): _columns(), _create_baseline_tables(), downgrade(), _indexes(), _unique_constraints(), upgrade()

### Community 102 - "test_run_queue.py"
Cohesion: 0.36
Nodes (9): claim_next_run(), request_cancel(), `tests/test_run_queue.py`, make_run(), make_session(), test_atomic_claim_prevents_second_claim(), test_cancel_queued_run_becomes_cancelled(), test_failure_requeues_with_backoff_until_attempt_limit() (+1 more)

### Community 103 - "merge_successful_run_state"
Cohesion: 0.39
Nodes (8): _descendants(), _digest(), _incoming_edges(), merge_successful_run_state(), _node_signature(), _nodes(), _normalized(), _result_changed()

### Community 104 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, @playwright/test, postcss, stylelint, @types/react, @types/react-dom, typescript, vite (+1 more)

### Community 105 - "authTokenStorage"
Cohesion: 0.20
Nodes (4): Authentication/profile, API boundary, authTokenStorage, LocalStorageAuthTokenStorage

### Community 106 - "WorkflowHeader.tsx"
Cohesion: 0.38
Nodes (6): ComponentEditorBanner, HeaderCenter(), HeaderLeft(), HeaderRight(), WorkflowHeaderProps, WorkflowHeader

### Community 107 - "20260724_0005_schema_convergence.py"
Cohesion: 0.39
Nodes (4): _add_missing_columns(), _columns(), _indexes(), upgrade()

### Community 108 - "contracts/types.py"
Cohesion: 0.42
Nodes (7): ValidationMessage, ValidationResult, WorkflowEdge, WorkflowGraph, WorkflowNode, WorkflowPort, `app/workflow/types.py`

### Community 109 - "IOTA ML"
Cohesion: 0.13
Nodes (15): Analysis boards and responsive execution, Architecture, Artifact storage, Authentication and role-based access, Backups, Central API contract, Development, Domain boundaries (+7 more)

### Community 110 - "Backend API compatibility"
Cohesion: 0.22
Nodes (8): Assistant, Backend API compatibility, Components, Envelope and errors, Node catalog/custom nodes, Projects, datasets and artifacts, Runs, Workflows and versions

### Community 111 - "check-css-debt.mjs"
Cohesion: 0.20
Nodes (8): cubes, entry, entryCss, failures, files, root, seen, postcss

### Community 112 - "rate_limit.py"
Cohesion: 0.11
Nodes (6): _client_key(), _local_allow(), rate_limit(), dependency(), _redis_allow(), ShutdownSignal

### Community 113 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, @amcharts/amcharts5, gsap, lucide-react, react, react-dom, @xyflow/react

### Community 115 - "`alembic/env.py`"
Cohesion: 0.67
Nodes (3): run_migrations_offline(), run_migrations_online(), `alembic/env.py`

### Community 116 - "Cubes.tsx"
Cohesion: 0.33
Nodes (4): CubesProps, Duration, Gap, gsap

### Community 117 - "20260712_0002_artifact_storage_and_domains.py"
Cohesion: 0.80
Nodes (4): _columns(), downgrade(), _indexes(), upgrade()

### Community 118 - "Reusable review workflows in IOTA ML"
Cohesion: 0.25
Nodes (8): case(), Delivered implementation and how to demonstrate it, Delivery gates, Error and performance contract, Forms and dashboards, Node set and order, Product model, Reusable review workflows in IOTA ML

### Community 119 - "Workflow"
Cohesion: 0.12
Nodes (12): AssistantMessage, AssistantMessageRepository, AssistantMessageOut, chat(), ChatRequest, ChatResponse, clear_history(), history() (+4 more)

### Community 121 - "Any"
Cohesion: 0.19
Nodes (6): DocumentExtractNode, DocumentOcrNode, _requested_extraction_values(), test_cached_dynamic_extraction_refreshes_run_local_form_references(), test_extraction_accepts_common_model_shapes_and_unknown_output(), test_extraction_ignores_model_keys_outside_requested_schema()

### Community 122 - "test_work_tasks.py"
Cohesion: 0.07
Nodes (39): create_notification(), TaskSubmission, TaskSubmissionWatch, assigned_form(), get_task(), list_tasks(), _serialize(), submit_task() (+31 more)

### Community 125 - "README.md"
Cohesion: 0.22
Nodes (4): Database migrations, Existing installation, Fresh database, Validation

### Community 126 - "Frontend API Compatibility"
Cohesion: 0.15
Nodes (12): Artifacts and cache, Assistant, Authentication, Compatibility policy, Components, Frontend API Compatibility, Intentional hardening that may change invalid requests, Nodes (+4 more)

### Community 176 - "Database Migration Guide"
Cohesion: 0.15
Nodes (12): 1. Stop write traffic, 2. Create a pre-migration backup, 3. Check current revision, 4. Inspect orphan checks before production upgrade, 5. Upgrade, 6. Verify preserved data, 7. Start services, Database Migration Guide (+4 more)

### Community 177 - "Backend Operations"
Cohesion: 0.15
Nodes (12): Artifact and cache maintenance, Backend Operations, Backup and restore, Development startup, Docker/Compose startup, Health and metrics, Logs, Required environment (+4 more)

### Community 178 - "Artifact Cache, Lineage, Autosave, and Workflow Versions"
Cohesion: 0.15
Nodes (13): Artifact Cache, Lineage, Autosave, and Workflow Versions, Artifact format and trust boundary, Artifact metadata and lineage, Autosave design, Cache key contract, Cacheable and non-cacheable nodes, Database migration, Execution model (+5 more)

### Community 180 - "Frontend rebuild report"
Cohesion: 0.18
Nodes (10): Compatibility decisions, Dependency changes, Frontend rebuild report, Known limitations, Main reconstruction, Original concentration points, Replacement, Scope inspected (+2 more)

### Community 181 - "ZScoreOutlierNode"
Cohesion: 0.36
Nodes (7): ZScoreOutlierNode, `app/nodes/anomaly_detection/z_score_node.py`, `tests/test_dual_dataframe_anomaly_nodes.py`, _inputs(), test_zscore_calculates_on_one_dataframe_and_reports_the_other(), test_zscore_rejects_an_unconnected_selection_immediately(), test_zscore_uses_one_multiple_port_and_two_source_selectors()

### Community 184 - "expressions.py"
Cohesion: 0.38
Nodes (6): ExpressionError, _path_get(), resolve_reference(), resolve_settings(), resolve_value(), `app/workflow/expressions.py`

### Community 185 - "Reliable training and data imports"
Cohesion: 0.14
Nodes (12): Custom-code policy and deployment, Files and Persian values, New nodes, Reliable training and data imports, SQL connections, Training, Commands, Contract suites (+4 more)

### Community 186 - "Reusable workflow components"
Cohesion: 0.22
Nodes (9): API surface, Creating a component, Database migration, Deletion and dependency safety, Editing the internal workflow, Import and export, Reusable workflow components, Runtime and caching (+1 more)

### Community 187 - "20260716_0003_node_cache_and_workflow_versions.py"
Cohesion: 0.80
Nodes (4): _columns(), downgrade(), _indexes(), upgrade()

### Community 191 - "IOTA ML frontend architecture"
Cohesion: 0.22
Nodes (9): Application providers, Chart lifecycle, CSS, Enforced boundaries, Goal, IOTA ML frontend architecture, Parameter and node editing, Reusable components (+1 more)

### Community 192 - "Performance model and budgets"
Cohesion: 0.22
Nodes (8): Bundle strategy, Chart lifecycle, Output and Board budgets, Performance model and budgets, Polling, Profiling, Removed high-cost coupling, Rendering budgets

### Community 193 - "State model"
Cohesion: 0.22
Nodes (8): 1. Server state, 2. Workflow document state, 3. Execution runtime state, 4. Output state, 5. UI state, Browser persistence, Hydration and persistence, State model

### Community 195 - "Authentication and Authorization"
Cohesion: 0.25
Nodes (7): Admin bootstrap, Authentication and Authorization, Migration, New-assignment state, Project permissions, Routes, System roles

### Community 197 - "amCharts rendering architecture"
Cohesion: 0.33
Nodes (5): amCharts rendering architecture, Licensing, Performance strategy, Supported output kinds, Theme contract

### Community 201 - "test_domain_architecture.py"
Cohesion: 0.50
Nodes (3): `tests/test_domain_architecture.py`, test_domain_packages_have_routes_and_boundaries(), test_main_registers_domain_routers_directly()

### Community 202 - "Multi-case review workflow"
Cohesion: 0.40
Nodes (4): Multi-case review workflow, Operating model, Persistence and retry rules, User flow

### Community 203 - "Dataframe utility nodes"
Cohesion: 0.50
Nodes (3): Combine DataFrames (`UT-003`), Dataframe utility nodes, Interactive Table (`UT-008`)

## Knowledge Gaps
- **4 isolated node(s):** `@types/react`, `@types/react-dom`, `stylelint`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1369 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **68 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Artifact Cache, Lineage, Autosave, and Workflow Versions` connect `Artifact Cache, Lineage, Autosave, and Workflow Versions` to `README.md`?**
  _High betweenness centrality (0.436) - this node is a cross-community bridge._
- **Are the 140 inferred relationships involving `User` (e.g. with `create_managed_user()` and `delete_user()`) actually correct?**
  _`User` has 140 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/react`, `@types/react-dom`, `stylelint` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Run` be split into smaller, more focused modules?**
  _Cohesion score 0.043055114778377236 - nodes in this community are weakly interconnected._
- **Why does `IOTA ML frontend architecture` connect `IOTA ML frontend architecture` to `authTokenStorage`, `board.ts`, `README.md`, `runtimeContext.ts`?**
  _High betweenness centrality (0.428) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `BaseNode` (e.g. with `NodeContractError` and `all_node_runners()`) actually correct?**
  _`BaseNode` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `components/routes.py` be split into smaller, more focused modules?**
  _Cohesion score 0.08419126058110273 - nodes in this community are weakly interconnected._