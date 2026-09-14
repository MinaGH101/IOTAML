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

export type ComponentDefinitionDraft = {
  name: string;
  description: string;
  semanticVersion: string;
  visibility: 'private' | 'project' | 'organization';
  inputs: ComponentBoundaryPort[];
  outputs: ComponentBoundaryPort[];
  exposedParameters: ExposedComponentParameter[];
};

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

export type ComponentVersionAction = {
  component: WorkflowComponent;
  version: ComponentVersionSummary;
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
