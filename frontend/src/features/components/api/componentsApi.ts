import type { ComponentCreatePayload, ComponentVersion, ComponentVersionSummary, RegistryNode, WorkflowComponent } from '../../../shared/_types';
import { jsonHeaders, projectQuery, request } from '../../../shared/api/httpClient';

export const componentsApi = {
  list: (projectId?: number | null, includeArchived = false, signal?: AbortSignal) => request<WorkflowComponent[]>(`/api/components${projectQuery(projectId)}${projectId ? '&' : '?'}include_archived=${includeArchived}`, { signal }),
  create: (payload: ComponentCreatePayload) => request<WorkflowComponent>('/api/components', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  get: (id: number, projectId?: number | null, signal?: AbortSignal) => request<WorkflowComponent>(`/api/components/${id}${projectQuery(projectId)}`, { signal }),
  update: (id: number, payload: Partial<Pick<WorkflowComponent, 'name' | 'description' | 'category' | 'icon' | 'visibility' | 'project_id' | 'archived'>>) => request<WorkflowComponent>(`/api/components/${id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(payload) }),
  remove: (id: number) => request<{ ok: boolean }>(`/api/components/${id}`, { method: 'DELETE' }),
  versions: (id: number, projectId?: number | null, signal?: AbortSignal) => request<ComponentVersionSummary[]>(`/api/components/${id}/versions${projectQuery(projectId)}`, { signal }),
  getVersion: (componentId: number, versionId: number, projectId?: number | null, signal?: AbortSignal) => request<ComponentVersion>(`/api/components/${componentId}/versions/${versionId}${projectQuery(projectId)}`, { signal }),
  createVersion: (componentId: number, payload: { semantic_version: string; graph: Record<string, unknown>; interface: ComponentVersion['interface_json']; exposed_parameters: ComponentVersion['exposed_parameters']; changelog: string }) => request<ComponentVersion>(`/api/components/${componentId}/versions`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  makeCurrent: (componentId: number, versionId: number) => request<WorkflowComponent>(`/api/components/${componentId}/versions/${versionId}/make-current`, { method: 'POST' }),
  removeVersion: (componentId: number, versionId: number) => request<{ ok: boolean }>(`/api/components/${componentId}/versions/${versionId}`, { method: 'DELETE' }),
  export: (id: number, versionId?: number | null) => request<Record<string, unknown>>(`/api/components/${id}/export${versionId ? `?version_id=${versionId}` : ''}`),
  import: (payload: Record<string, unknown>) => request<WorkflowComponent>('/api/components/import', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  registry: (id: number, projectId?: number | null) => request<RegistryNode>(`/api/components/${id}/registry${projectQuery(projectId)}`),
};
