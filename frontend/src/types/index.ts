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
  | 'User Nodes';

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
  type: 'text' | 'textarea' | 'code' | 'file' | 'number' | 'integer' | 'float' | 'color' | 'boolean' | 'select' | 'multiselect' | 'column' | 'columns' | 'dataset' | 'replacement_blocks' | 'imputation_blocks' | 'normalization_blocks' | 'scatter_blocks';
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
  isCustom?: boolean;
  owner_username?: string;
  code?: string;
  template?: Record<string, unknown> | null;
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
  created_at: string;
  updated_at: string;
};

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out';

export type RunNodeStatus = {
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';
  name?: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  error?: string | null;
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
  dataset_id: number | null;
  project_id: number | null;
  owner_username: string;
  target_column: string | null;
  task_type: string;
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
