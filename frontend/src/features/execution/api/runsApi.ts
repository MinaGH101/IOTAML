import type { Run, RunProgressSnapshot, RunSummary } from '../../../shared/_types';
import { jsonHeaders, projectQuery, request } from '../../../shared/api/httpClient';

export const runsApi = {
  create: (payload: Record<string, unknown>) => request<Run>('/api/runs', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  get: (id: number, signal?: AbortSignal) => request<Run>(`/api/runs/${id}`, { signal }),
  progress: (id: number, signal?: AbortSignal) => request<RunProgressSnapshot>(`/api/runs/${id}/progress`, { signal, timeoutMs: 15_000 }),
  cancel: (id: number) => request<Run>(`/api/runs/${id}/cancel`, { method: 'POST' }),
  retry: (id: number) => request<Run>(`/api/runs/${id}/retry`, { method: 'POST' }),
  list: (projectId?: number | null, signal?: AbortSignal) => request<RunSummary[]>(`/api/runs${projectQuery(projectId)}`, { signal }),
};
