import type { Artifact, ArtifactUsage, AssignableUser, Dataset, Project, ProjectPayload } from '../../shared/types';
import { jsonHeaders, projectQuery, request } from '../../shared/api/httpClient';

export const projectsApi = {
  sqlSources: (signal?: AbortSignal) => request<Array<{ name: string; tables: string[] }>>('/api/datasets/sql-sources', { signal }),
  importSql: (payload: { source: string; table: string; project_id: number; limit: number }) => request<Dataset>('/api/datasets/sql-import', { timeoutMs: 120_000, method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  list: (signal?: AbortSignal) => request<Project[]>('/api/projects', { signal }),
  assignableUsers: (signal?: AbortSignal) => request<AssignableUser[]>('/api/projects/assignable-users', { signal }),
  acknowledge: (id: number) => request<{ ok: boolean }>(`/api/projects/${id}/acknowledge`, { method: 'POST' }),
  create: (payload: ProjectPayload) => request<Project>('/api/projects', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  update: (id: number, payload: ProjectPayload) => request<Project>(`/api/projects/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(payload) }),
  get: (id: number, signal?: AbortSignal) => request<Project>(`/api/projects/${id}`, { signal }),
  remove: (id: number) => request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
  datasets: (projectId?: number | null, signal?: AbortSignal) => request<Dataset[]>(`/api/datasets${projectQuery(projectId)}`, { signal }),
  uploadDataset: async (file: File, projectId?: number | null) => {
    const body = new FormData();
    body.append('file', file);
    if (projectId) body.append('project_id', String(projectId));
    return request<Dataset>('/api/datasets/upload', { method: 'POST', body });
  },
  deleteDataset: (id: number) => request<{ ok: boolean }>(`/api/datasets/${id}`, { method: 'DELETE' }),
  artifacts: (projectId?: number | null, signal?: AbortSignal) => request<Artifact[]>(`/api/artifacts${projectQuery(projectId)}`, { signal }),
  artifactUsage: (projectId?: number | null, signal?: AbortSignal) => request<ArtifactUsage>(`/api/artifacts/usage${projectQuery(projectId)}`, { signal }),
  artifactDownloadUrl: (id: number) => request<{ artifact_id: number; url: string; expires_in_seconds: number }>(`/api/artifacts/${id}/download-url`),
  deleteArtifact: (id: number) => request<{ ok: boolean }>(`/api/artifacts/${id}`, { method: 'DELETE' }),
  cacheStats: (projectId?: number | null) => request<{ project_id: number | null; entries: number; size_bytes: number; hits: number }>(`/api/artifacts/cache/stats${projectQuery(projectId)}`),
  clearCache: (projectId?: number | null) => request<{ ok: boolean; removed: number }>(`/api/artifacts/cache${projectQuery(projectId)}`, { method: 'DELETE' }),
};
