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
  | 'Utilities / Advanced';

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
  type: 'text' | 'textarea' | 'code' | 'number' | 'integer' | 'float' | 'color' | 'boolean' | 'select' | 'multiselect' | 'column' | 'columns' | 'dataset' | 'replacement_blocks' | 'imputation_blocks' | 'normalization_blocks' | 'scatter_blocks';
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
};

export type Dataset = {
  id: number;
  name: string;
  filename: string;
  row_count: number;
  project_id: number | null;
  columns: Array<{ name: string; dtype: string; missing: number; unique: number }>;
  created_at: string;
};

export type Workflow = {
  id: number;
  name: string;
  graph: Record<string, unknown>;
  project_id: number | null;
  created_at: string;
  updated_at: string;
};

export type Run = {
  id: number;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'pending' | 'success' | 'skipped' | 'cached';
  workflow_name: string;
  workflow_graph: Record<string, unknown>;
  dataset_id: number | null;
  project_id: number | null;
  target_column: string | null;
  task_type: string;
  metrics: Record<string, unknown> | null;
  artifacts: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
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
