import type { CustomNodeDefinition, CustomNodePayload, NodeCatalogResponse } from '../../../shared/_types';
import { jsonHeaders, projectQuery, request } from '../../../shared/api/httpClient';

export const nodesApi = {
  catalog: (projectId?: number | null, signal?: AbortSignal) => request<NodeCatalogResponse>(`/api/nodes/catalog${projectQuery(projectId)}`, { signal }),
  getCustom: (id: string, signal?: AbortSignal) => request<CustomNodeDefinition>(`/api/nodes/custom/${id}`, { signal }),
  createCustom: (payload: CustomNodePayload) => request<CustomNodeDefinition>('/api/nodes/custom', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  updateCustom: (id: string, payload: CustomNodePayload) => request<CustomNodeDefinition>(`/api/nodes/custom/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(payload) }),
  removeCustom: (id: string) => request<{ ok: boolean }>(`/api/nodes/custom/${id}`, { method: 'DELETE' }),
};
