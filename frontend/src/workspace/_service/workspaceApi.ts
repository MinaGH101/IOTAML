import type {
  ComponentCreatePayload,
  ComponentVersion,
  ComponentVersionSummary,
  CustomNodeDefinition,
  CustomNodePayload,
  NodeCatalogResponse,
  RegistryNode,
  Run,
  RunProgressSnapshot,
  RunSummary,
  Workflow,
  WorkflowComponent,
  WorkflowValidationResult,
  WorkflowVersion,
  WorkflowVersionSummary,
} from '../../shared/_types';
import { jsonHeaders, projectQuery, request } from '../../shared/_service/httpClient';

export const workspaceApi = {
  nodeCatalog: () => request<NodeCatalogResponse>('/api/nodes/catalog'),
  customNode: (id: string) => request<CustomNodeDefinition>(`/api/nodes/custom/${id}`),
  createCustomNode: (payload: CustomNodePayload) =>
    request<CustomNodeDefinition>('/api/nodes/custom', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  updateCustomNode: (id: string, payload: CustomNodePayload) =>
    request<CustomNodeDefinition>(`/api/nodes/custom/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  deleteCustomNode: (id: string) =>
    request<{ ok: boolean }>(`/api/nodes/custom/${id}`, { method: 'DELETE' }),
  components: (projectId?: number | null, includeArchived = false) =>
    request<WorkflowComponent[]>(
      `/api/components${projectQuery(projectId)}${projectId ? '&' : '?'}include_archived=${includeArchived}`,
    ),
  createComponent: (payload: ComponentCreatePayload) =>
    request<WorkflowComponent>('/api/components', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  getComponent: (id: number, projectId?: number | null) =>
    request<WorkflowComponent>(`/api/components/${id}${projectQuery(projectId)}`),
  updateComponent: (
    id: number,
    payload: Partial<
      Pick<
        WorkflowComponent,
        'name' | 'description' | 'category' | 'icon' | 'visibility' | 'project_id' | 'archived'
      >
    >,
  ) =>
    request<WorkflowComponent>(`/api/components/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  deleteComponent: (id: number) =>
    request<{ ok: boolean }>(`/api/components/${id}`, { method: 'DELETE' }),
  componentVersions: (id: number, projectId?: number | null) =>
    request<ComponentVersionSummary[]>(
      `/api/components/${id}/versions${projectQuery(projectId)}`,
    ),
  getComponentVersion: (componentId: number, versionId: number, projectId?: number | null) =>
    request<ComponentVersion>(
      `/api/components/${componentId}/versions/${versionId}${projectQuery(projectId)}`,
    ),
  createComponentVersion: (
    componentId: number,
    payload: {
      semantic_version: string;
      graph: Record<string, unknown>;
      interface: ComponentVersion['interface_json'];
      exposed_parameters: ComponentVersion['exposed_parameters'];
      changelog: string;
    },
  ) =>
    request<ComponentVersion>(`/api/components/${componentId}/versions`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  makeComponentVersionCurrent: (componentId: number, versionId: number) =>
    request<WorkflowComponent>(
      `/api/components/${componentId}/versions/${versionId}/make-current`,
      { method: 'POST' },
    ),
  deleteComponentVersion: (componentId: number, versionId: number) =>
    request<{ ok: boolean }>(`/api/components/${componentId}/versions/${versionId}`, {
      method: 'DELETE',
    }),
  exportComponent: (id: number, versionId?: number | null) =>
    request<Record<string, unknown>>(
      `/api/components/${id}/export${versionId ? `?version_id=${versionId}` : ''}`,
    ),
  importComponent: (payload: Record<string, unknown>) =>
    request<WorkflowComponent>('/api/components/import', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  componentRegistry: (id: number, projectId?: number | null) =>
    request<RegistryNode>(`/api/components/${id}/registry${projectQuery(projectId)}`),
  workflows: (projectId?: number | null) =>
    request<Workflow[]>(`/api/workflows${projectQuery(projectId)}`),
  createWorkflow: (payload: {
    name: string;
    graph: Record<string, unknown>;
    project_id?: number | null;
    last_run_id?: number | null;
  }) =>
    request<Workflow>('/api/workflows', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  renameWorkflow: (id: number, name: string) =>
    request<Workflow>(`/api/workflows/${id}/name`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ name }),
    }),
  deleteWorkflow: (id: number) =>
    request<{ ok: boolean }>(`/api/workflows/${id}`, { method: 'DELETE' }),
  getWorkflow: (id: number) => request<Workflow>(`/api/workflows/${id}`),
  autosaveWorkflow: (
    id: number,
    payload: {
      name: string;
      graph: Record<string, unknown>;
      project_id?: number | null;
      last_run_id?: number | null;
      base_revision?: number | null;
      client_graph_hash?: string | null;
    },
  ) =>
    request<Workflow>(`/api/workflows/${id}/autosave`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  workflowVersions: (id: number) =>
    request<WorkflowVersionSummary[]>(`/api/workflows/${id}/versions`),
  getWorkflowVersion: (workflowId: number, versionId: number) =>
    request<WorkflowVersion>(`/api/workflows/${workflowId}/versions/${versionId}`),
  createWorkflowVersion: (
    workflowId: number,
    payload: { name: string; description?: string; run_id?: number | null },
  ) =>
    request<WorkflowVersion>(`/api/workflows/${workflowId}/versions`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  restoreWorkflowVersion: (workflowId: number, versionId: number) =>
    request<Workflow>(`/api/workflows/${workflowId}/versions/${versionId}/restore`, {
      method: 'POST',
    }),
  deleteWorkflowVersion: (workflowId: number, versionId: number) =>
    request<{ ok: boolean }>(`/api/workflows/${workflowId}/versions/${versionId}`, {
      method: 'DELETE',
    }),
  validateWorkflow: (graph: Record<string, unknown>) =>
    request<WorkflowValidationResult>('/api/workflows/validate', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ graph }),
    }),
  createRun: (payload: Record<string, unknown>) =>
    request<Run>('/api/runs', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  getRun: (id: number) => request<Run>(`/api/runs/${id}`),
  runProgress: (id: number) => request<RunProgressSnapshot>(`/api/runs/${id}/progress`),
  cancelRun: (id: number) => request<Run>(`/api/runs/${id}/cancel`, { method: 'POST' }),
  retryRun: (id: number) => request<Run>(`/api/runs/${id}/retry`, { method: 'POST' }),
  listRuns: (projectId?: number | null) =>
    request<RunSummary[]>(`/api/runs${projectQuery(projectId)}`),
  assistantChat: (payload: { message: string; workflow_id?: number | null }) =>
    request<{ message: string }>('/api/assistant/chat', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
};
