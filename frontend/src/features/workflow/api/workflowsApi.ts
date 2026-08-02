import type { Workflow, WorkflowValidationResult, WorkflowVersion, WorkflowVersionSummary } from '../../../shared/_types';
import { jsonHeaders, projectQuery, request } from '../../../shared/api/httpClient';

export type AutosaveWorkflowPayload = {
  name: string;
  graph: Record<string, unknown>;
  project_id?: number | null;
  last_run_id?: number | null;
  base_revision?: number | null;
  client_graph_hash?: string | null;
};

export const workflowsApi = {
  list: (projectId?: number | null, signal?: AbortSignal) => request<Workflow[]>(`/api/workflows${projectQuery(projectId)}`, { signal }),
  create: (payload: { name: string; graph: Record<string, unknown>; project_id?: number | null; last_run_id?: number | null }) => request<Workflow>('/api/workflows', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  get: (id: number, signal?: AbortSignal) => request<Workflow>(`/api/workflows/${id}`, { signal }),
  rename: (id: number, name: string) => request<Workflow>(`/api/workflows/${id}/name`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ name }) }),
  remove: (id: number) => request<{ ok: boolean }>(`/api/workflows/${id}`, { method: 'DELETE' }),
  autosave: (id: number, payload: AutosaveWorkflowPayload, signal?: AbortSignal) => request<Workflow>(`/api/workflows/${id}/autosave`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(payload), signal }),
  validate: (graph: Record<string, unknown>, signal?: AbortSignal) => request<WorkflowValidationResult>('/api/workflows/validate', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ graph }), signal }),
  versions: (id: number, signal?: AbortSignal) => request<WorkflowVersionSummary[]>(`/api/workflows/${id}/versions`, { signal }),
  getVersion: (workflowId: number, versionId: number, signal?: AbortSignal) => request<WorkflowVersion>(`/api/workflows/${workflowId}/versions/${versionId}`, { signal }),
  createVersion: (workflowId: number, payload: { name: string; description?: string; run_id?: number | null }) => request<WorkflowVersion>(`/api/workflows/${workflowId}/versions`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  restoreVersion: (workflowId: number, versionId: number) => request<Workflow>(`/api/workflows/${workflowId}/versions/${versionId}/restore`, { method: 'POST' }),
  removeVersion: (workflowId: number, versionId: number) => request<{ ok: boolean }>(`/api/workflows/${workflowId}/versions/${versionId}`, { method: 'DELETE' }),
};
