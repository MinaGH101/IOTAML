import type { Artifact, ArtifactUsage, ComponentCreatePayload, ComponentVersion, ComponentVersionSummary, CustomNodeDefinition, CustomNodePayload, Dataset, LoginResponse, NodeCatalogResponse, Project, ProjectPayload, RegistryNode, Run, RunProgressSnapshot, RunSummary, UserProfile, Workflow, WorkflowComponent, WorkflowValidationResult, WorkflowVersion, WorkflowVersionSummary } from './types';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
const AUTH_KEY = 'iota-auth-token';

export function getAuthToken() {
  return localStorage.getItem(AUTH_KEY) || '';
}

export function setAuthToken(token: string) {
  localStorage.setItem(AUTH_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_KEY);
}

export class ApiError extends Error {
  code: string;
  details: Record<string, unknown>;
  requestId: string;
  status: number;

  constructor(message: string, options: { code?: string; details?: Record<string, unknown>; requestId?: string; status?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code || 'REQUEST_FAILED';
    this.details = options.details || {};
    this.requestId = options.requestId || '';
    this.status = options.status || 0;
  }
}

type ApiEnvelope<T> =
  | { success: true; data: T; meta: Record<string, unknown>; request_id: string }
  | { success: false; error: { code: string; message: string; details: Record<string, unknown> }; request_id: string };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const payload = await res.json().catch(() => null) as ApiEnvelope<T> | T | null;

  if (payload && typeof payload === 'object' && 'success' in payload) {
    if (payload.success) return payload.data;
    throw new ApiError(payload.error.message || 'Request failed', {
      code: payload.error.code,
      details: payload.error.details,
      requestId: payload.request_id,
      status: res.status
    });
  }

  if (!res.ok) {
    const legacy = payload as { detail?: string } | null;
    throw new ApiError(legacy?.detail || res.statusText || 'Request failed', { status: res.status });
  }
  return payload as T;
}

const jsonHeaders = { 'Content-Type': 'application/json' };
const projectQuery = (projectId?: number | null) => (projectId ? `?project_id=${projectId}` : '');

export const api = {
  login: (payload: { username: string; password: string }) =>
    request<LoginResponse>('/api/auth/login', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  me: () => request<UserProfile>('/api/auth/me'),
  updateProfile: (payload: Partial<UserProfile>) =>
    request<UserProfile>('/api/auth/profile', { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(payload) }),
  uploadProfileImage: async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<UserProfile>('/api/auth/profile-image', { method: 'POST', body });
  },

  projects: () => request<Project[]>('/api/projects'),
  createProject: (payload: ProjectPayload) =>
    request<Project>('/api/projects', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  updateProject: (id: number, payload: ProjectPayload) =>
    request<Project>(`/api/projects/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(payload) }),
  getProject: (id: number) => request<Project>(`/api/projects/${id}`),
  deleteProject: (id: number) => request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),

  nodes: () => request<RegistryNode[]>('/api/nodes'),
  nodeCatalog: () => request<NodeCatalogResponse>('/api/nodes/catalog'),
  customNode: (id: string) => request<CustomNodeDefinition>(`/api/nodes/custom/${id}`),
  createCustomNode: (payload: CustomNodePayload) => request<CustomNodeDefinition>('/api/nodes/custom', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  updateCustomNode: (id: string, payload: CustomNodePayload) => request<CustomNodeDefinition>(`/api/nodes/custom/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(payload) }),
  deleteCustomNode: (id: string) => request<{ ok: boolean }>(`/api/nodes/custom/${id}`, { method: 'DELETE' }),
  components: (projectId?: number | null, includeArchived = false) => request<WorkflowComponent[]>(`/api/components${projectQuery(projectId)}${projectId ? '&' : '?'}include_archived=${includeArchived}`),
  createComponent: (payload: ComponentCreatePayload) => request<WorkflowComponent>('/api/components', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  getComponent: (id: number, projectId?: number | null) => request<WorkflowComponent>(`/api/components/${id}${projectQuery(projectId)}`),
  updateComponent: (id: number, payload: Partial<Pick<WorkflowComponent, 'name' | 'description' | 'category' | 'icon' | 'visibility' | 'project_id' | 'archived'>>) => request<WorkflowComponent>(`/api/components/${id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(payload) }),
  deleteComponent: (id: number) => request<{ ok: boolean }>(`/api/components/${id}`, { method: 'DELETE' }),
  componentVersions: (id: number, projectId?: number | null) => request<ComponentVersionSummary[]>(`/api/components/${id}/versions${projectQuery(projectId)}`),
  getComponentVersion: (componentId: number, versionId: number, projectId?: number | null) => request<ComponentVersion>(`/api/components/${componentId}/versions/${versionId}${projectQuery(projectId)}`),
  createComponentVersion: (componentId: number, payload: { semantic_version: string; graph: Record<string, unknown>; interface: ComponentVersion['interface_json']; exposed_parameters: ComponentVersion['exposed_parameters']; changelog: string }) => request<ComponentVersion>(`/api/components/${componentId}/versions`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  makeComponentVersionCurrent: (componentId: number, versionId: number) => request<WorkflowComponent>(`/api/components/${componentId}/versions/${versionId}/make-current`, { method: 'POST' }),
  deleteComponentVersion: (componentId: number, versionId: number) => request<{ ok: boolean }>(`/api/components/${componentId}/versions/${versionId}`, { method: 'DELETE' }),
  componentUsage: (id: number) => request<{ component_id: number; usage_count: number }>(`/api/components/${id}/usage`),
  exportComponent: (id: number, versionId?: number | null) => request<Record<string, unknown>>(`/api/components/${id}/export${versionId ? `?version_id=${versionId}` : ''}`),
  importComponent: (payload: Record<string, unknown>) => request<WorkflowComponent>('/api/components/import', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  componentRegistry: (id: number, projectId?: number | null) => request<RegistryNode>(`/api/components/${id}/registry${projectQuery(projectId)}`),
  datasets: (projectId?: number | null) => request<Dataset[]>(`/api/datasets${projectQuery(projectId)}`),
  uploadDataset: async (file: File, projectId?: number | null) => {
    const body = new FormData();
    body.append('file', file);
    if (projectId) body.append('project_id', String(projectId));
    return request<Dataset>('/api/datasets/upload', { method: 'POST', body });
  },
  deleteDataset: (id: number) => request<{ ok: boolean }>(`/api/datasets/${id}`, { method: 'DELETE' }),
  workflows: (projectId?: number | null) => request<Workflow[]>(`/api/workflows${projectQuery(projectId)}`),
  createWorkflow: (payload: { name: string; graph: Record<string, unknown>; project_id?: number | null; last_run_id?: number | null }) =>
    request<Workflow>('/api/workflows', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  updateWorkflow: (id: number, payload: { name: string; graph: Record<string, unknown>; project_id?: number | null; last_run_id?: number | null }) =>
    request<Workflow>(`/api/workflows/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(payload) }),
  renameWorkflow: (id: number, name: string) =>
    request<Workflow>(`/api/workflows/${id}/name`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ name }) }),
  deleteWorkflow: (id: number) =>
    request<{ ok: boolean }>(`/api/workflows/${id}`, { method: 'DELETE' }),
  getWorkflow: (id: number) => request<Workflow>(`/api/workflows/${id}`),
  autosaveWorkflow: (id: number, payload: { name: string; graph: Record<string, unknown>; project_id?: number | null; last_run_id?: number | null; base_revision?: number | null; client_graph_hash?: string | null }) =>
    request<Workflow>(`/api/workflows/${id}/autosave`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(payload) }),
  workflowVersions: (id: number) => request<WorkflowVersionSummary[]>(`/api/workflows/${id}/versions`),
  getWorkflowVersion: (workflowId: number, versionId: number) => request<WorkflowVersion>(`/api/workflows/${workflowId}/versions/${versionId}`),
  createWorkflowVersion: (workflowId: number, payload: { name: string; description?: string; run_id?: number | null }) =>
    request<WorkflowVersion>(`/api/workflows/${workflowId}/versions`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  restoreWorkflowVersion: (workflowId: number, versionId: number) =>
    request<Workflow>(`/api/workflows/${workflowId}/versions/${versionId}/restore`, { method: 'POST' }),
  deleteWorkflowVersion: (workflowId: number, versionId: number) =>
    request<{ ok: boolean }>(`/api/workflows/${workflowId}/versions/${versionId}`, { method: 'DELETE' }),
  validateWorkflow: (graph: Record<string, unknown>) =>
    request<WorkflowValidationResult>('/api/workflows/validate', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ graph }) }),
  createRun: (payload: Record<string, unknown>) =>
    request<Run>('/api/runs', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  getRun: (id: number) => request<Run>(`/api/runs/${id}`),
  runProgress: (id: number) => request<RunProgressSnapshot>(`/api/runs/${id}/progress`),
  nodePreview: (runId: number, nodeId: string) => request<Record<string, unknown>>(`/api/runs/${runId}/nodes/${nodeId}/preview`),
  cancelRun: (id: number) => request<Run>(`/api/runs/${id}/cancel`, { method: 'POST' }),
  retryRun: (id: number) => request<Run>(`/api/runs/${id}/retry`, { method: 'POST' }),
  runLogs: (id: number) => request<{ run_id: number; status: string; logs: Run['logs'] }>(`/api/runs/${id}/logs`),
  queueHealth: () => request<Record<string, unknown>>('/api/runs/queue/health'),
  nodeExecutions: (id: number) => request<Array<Record<string, unknown>>>(`/api/runs/${id}/node-executions`),
  listRuns: (projectId?: number | null) => request<RunSummary[]>(`/api/runs${projectQuery(projectId)}`),

  assistantChat: (payload: { message: string; workflow_id?: number | null }) =>
    request<{ message: string }>('/api/assistant/chat', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),

  artifacts: (projectId?: number | null) => request<Artifact[]>(`/api/artifacts${projectQuery(projectId)}`),
  artifactUsage: (projectId?: number | null) => request<ArtifactUsage>(`/api/artifacts/usage${projectQuery(projectId)}`),
  artifactDownloadUrl: (id: number) => request<{ artifact_id: number; url: string; expires_in_seconds: number }>(`/api/artifacts/${id}/download-url`),
  deleteArtifact: (id: number) => request<{ ok: boolean }>(`/api/artifacts/${id}`, { method: 'DELETE' }),
  cacheStats: (projectId?: number | null) => request<{ project_id: number | null; entries: number; size_bytes: number; hits: number }>(`/api/artifacts/cache/stats${projectQuery(projectId)}`),
  clearCache: (projectId?: number | null) => request<{ ok: boolean; removed: number }>(`/api/artifacts/cache${projectQuery(projectId)}`, { method: 'DELETE' })
};
