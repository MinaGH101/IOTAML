export type NodeCategory =
  | 'Data Input'
  | 'Data Inspection'
  | 'Data Cleaning'
  | 'Anomaly Detection'
  | 'Transformation'
  | 'Visualizations'
  | 'ML Data Processing'
  | 'ML Regression Models'
  | 'ML Classification Models'
  | 'ML Model Analysis'
  | 'Export or Report'
  | 'Utilities / Advanced'
  | 'User Nodes'
  | 'Components';

export type PortType =
  | 'dataframe'
  | 'json'
  | 'json_items'
  | 'series'
  | 'columns'
  | 'model'
  | 'metrics'
  | 'plot'
  | 'file'
  | 'report'
  | 'artifact'
  | 'artifact_ref'
  | 'text'
  | 'schema'
  | 'trigger'
  | 'stream'
  | 'any';

export type PortDefinition = {
  id: string;
  name: string;
  type: PortType | string;
  required: boolean;
  multiple: boolean;
};

export type NodeParam = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'code' | 'file' | 'data_file' | 'number' | 'integer' | 'float' | 'color' | 'boolean' | 'select' | 'multiselect' | 'column' | 'columns' | 'dataset' | 'replacement_blocks' | 'imputation_blocks' | 'normalization_blocks' | 'scatter_blocks' | 'row_values' | 'series_colors';
  default: unknown;
  required?: boolean;
  options: unknown[];
  supportsDynamic?: boolean;
  help?: string;
};

export type DynamicSettingValue = { mode: 'static' | 'dynamic'; value?: unknown; expression?: string };

export type RegistryNode = {
  id: string;
  type?: string;
  name?: string;
  label: string;
  category: NodeCategory;
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  settingsSchema: NodeParam[];
  params: NodeParam[];
  executionMode: 'instant' | 'queued' | 'sandboxed';
  supportsDynamicParameters: boolean;
  implemented: boolean;
  comingSoon?: boolean;
  priority?: string;
  validationRules?: string;
  cacheable?: boolean;
  cacheVersion?: string;
  isCustom?: boolean;
  owner_username?: string;
  code?: string;
  template?: Record<string, unknown> | null;
  isComponent?: boolean;
  componentId?: number;
  componentVersionId?: number;
  componentVersion?: string;
};

export type NodeCatalogResponse = {
  version: number;
  nodes: RegistryNode[];
  aliases: Record<string, string>;
  categories: NodeCategory[];
  compatiblePorts: Record<string, string[]>;
};

export type Dataset = {
  id: number;
  name: string;
  filename: string;
  row_count: number;
  project_id: number | null;
  artifact_id: number | null;
  content_type: string;
  size_bytes: number;
  checksum_sha256: string | null;
  columns: Array<{ name: string; dtype: string; missing: number; unique: number }>;
  created_at: string;
};

export type Artifact = {
  id: number;
  project_id: number | null;
  workflow_id: number | null;
  run_id: number | null;
  node_id: string | null;
  owner_username: string;
  artifact_type: string;
  storage_backend: 'local' | 'minio' | string;
  original_filename: string;
  logical_name: string;
  version: number;
  parent_artifact_id: number | null;
  content_type: string;
  size_bytes: number;
  checksum_sha256: string;
  cache_key: string | null;
  schema_json: Record<string, unknown> | null;
  metadata_json: Record<string, unknown> | null;
  pinned: boolean;
  last_accessed_at: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
};

export type ArtifactUsage = {
  project_id: number | null;
  total_bytes: number;
  quota_bytes: number;
  artifact_count: number;
  by_type: Record<string, number>;
};

export type Workflow = {
  id: number;
  name: string;
  graph: Record<string, unknown>;
  project_id: number | null;
  last_run_id: number | null;
  owner_username: string;
  revision: number;
  graph_hash: string;
  last_autosaved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowVersionSummary = {
  id: number;
  workflow_id: number;
  version_number: number;
  name: string;
  description: string;
  graph_hash: string;
  source_revision: number;
  run_id: number | null;
  created_at: string;
};

export type WorkflowVersion = WorkflowVersionSummary & {
  graph: Record<string, unknown>;
  owner_username: string;
};


export type ComponentBoundaryPort = {
  id: string;
  name: string;
  type: string;
  required: boolean;
  multiple: boolean;
  internal_node_id: string;
  internal_handle: string;
};

export type ExposedComponentParameter = {
  id: string;
  name: string;
  description: string;
  type: string;
  default: unknown;
  required: boolean;
  options: unknown[];
  internal_node_id: string;
  internal_param: string;
};

export type ComponentVersion = {
  id: number;
  component_id: number;
  version_number: number;
  semantic_version: string;
  name: string;
  description: string;
  graph: Record<string, unknown>;
  graph_hash: string;
  interface_json: { inputs: ComponentBoundaryPort[]; outputs: ComponentBoundaryPort[] };
  exposed_parameters: ExposedComponentParameter[];
  dependencies_json: Array<{ component_id: number; version_id: number }>;
  changelog: string;
  owner_username: string;
  created_at: string;
};

export type ComponentVersionSummary = Pick<ComponentVersion, 'id' | 'component_id' | 'version_number' | 'semantic_version' | 'graph_hash' | 'changelog' | 'created_at'>;

export type WorkflowComponent = {
  id: number;
  name: string;
  description: string;
  category: string;
  icon: string;
  visibility: 'private' | 'project' | 'organization';
  project_id: number | null;
  owner_username: string;
  current_version_id: number | null;
  archived: boolean;
  current_version: ComponentVersion | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
};

export type ComponentCreatePayload = {
  name: string;
  description: string;
  category: string;
  icon: string;
  visibility: 'private' | 'project' | 'organization';
  project_id?: number | null;
  semantic_version: string;
  graph: Record<string, unknown>;
  interface: { inputs: ComponentBoundaryPort[]; outputs: ComponentBoundaryPort[] };
  exposed_parameters: ExposedComponentParameter[];
  changelog: string;
};

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out';

export type RunNodeStatus = {
  status: 'queued' | 'running' | 'cached' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';
  name?: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  error?: string | null;
  cache_hit?: boolean;
  cache_key?: string | null;
  cache_entry_id?: number | null;
  artifact_id?: number | null;
  source_run_id?: number | null;
  output_digest?: string | null;
  output_size_bytes?: number | null;
};

export type RunProgressSnapshot = {
  run_id: number;
  status: RunStatus;
  attempts: number;
  max_attempts: number;
  cancel_requested: boolean;
  heartbeat_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  progress: { nodes_total?: number; nodes_finished?: number; percent?: number; current_node_id?: string | null; updated_at?: number } | null;
  node_statuses: Record<string, RunNodeStatus>;
};

export type RunSummary = {
  id: number;
  status: RunStatus;
  workflow_name: string;
  project_id: number | null;
  attempts: number;
  max_attempts: number;
  cancel_requested: boolean;
  progress: { nodes_total?: number; nodes_finished?: number; percent?: number; current_node_id?: string | null; updated_at?: number } | null;
  error: string | null;
  created_at: string;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type Run = {
  id: number;
  status: RunStatus;
  workflow_name: string;
  workflow_graph: Record<string, unknown>;
  workflow_id: number | null;
  workflow_revision: number | null;
  dataset_id: number | null;
  project_id: number | null;
  owner_username: string;
  target_column: string | null;
  task_type: string;
  bypass_cache: boolean;
  priority: number;
  attempts: number;
  max_attempts: number;
  timeout_seconds: number;
  cancel_requested: boolean;
  locked_by: string | null;
  heartbeat_at: string | null;
  process_pid: number | null;
  progress: { nodes_total?: number; nodes_finished?: number; percent?: number; current_node_id?: string | null; updated_at?: number } | null;
  node_statuses: Record<string, RunNodeStatus> | null;
  logs: Array<{ timestamp: string; level: string; message: string; context?: Record<string, unknown> }> | null;
  metrics: Record<string, unknown> | null;
  artifacts: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
};


export type WorkflowValidationMessage = {
  level: 'error' | 'warning';
  nodeId?: string | null;
  edgeId?: string | null;
  type: string;
  message: string;
  suggestedFix?: string | null;
};

export type WorkflowValidationResult = {
  valid: boolean;
  errors: WorkflowValidationMessage[];
  warnings: WorkflowValidationMessage[];
};

export type ProjectState = 'open' | 'closed';
export type ProjectPriority = 'low' | 'medium' | 'high';

export type Project = {
  id: number;
  name: string;
  description: string;
  start_date: string | null;
  due_date: string | null;
  project_manager: string;
  state: ProjectState;
  priority: ProjectPriority;
  color: string;
  owner_username: string;
  workflow_count: number;
  dataset_count: number;
  created_at: string;
  updated_at: string;
};

export type ProjectPayload = {
  name: string;
  description: string;
  start_date: string | null;
  due_date: string | null;
  project_manager: string;
  state: ProjectState;
  priority: ProjectPriority;
  color: string;
};

export type UserProfile = {
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  access_level: string;
  profile_image: string;
  title: string;
  department: string;
  activity: Array<{ label: string; value: number }>;
  alarms: Array<{ title: string; message: string; level?: string }>;
  notifications: Array<{ title: string; message: string; time?: string }>;
};

export type LoginResponse = {
  access_token: string;
  token_type: 'bearer';
  user: UserProfile;
};


export type CustomNodePayload = {
  name: string;
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  code: string;
  template: Record<string, unknown> | null;
};

export type CustomNodeDefinition = RegistryNode & CustomNodePayload & {
  id: string;
  isCustom: true;
  created_at?: string;
  updated_at?: string;
};
