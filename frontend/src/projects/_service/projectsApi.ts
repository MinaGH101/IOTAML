import type {
  Artifact,
  ArtifactUsage,
  Dataset,
  Project,
  ProjectPayload,
} from '../../shared/_types';
import { jsonHeaders, projectQuery, request } from '../../shared/_service/httpClient';

export const projectsApi = {
  list: () => request<Project[]>('/api/projects'),
  create: (payload: ProjectPayload) =>
    request<Project>('/api/projects', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  update: (id: number, payload: ProjectPayload) =>
    request<Project>(`/api/projects/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),
  get: (id: number) => request<Project>(`/api/projects/${id}`),
  remove: (id: number) => request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
  datasets: (projectId?: number | null) =>
    request<Dataset[]>(`/api/datasets${projectQuery(projectId)}`),
  uploadDataset: async (file: File, projectId?: number | null) => {
    const body = new FormData();
    body.append('file', file);
    if (projectId) body.append('project_id', String(projectId));
    return request<Dataset>('/api/datasets/upload', { method: 'POST', body });
  },
  deleteDataset: (id: number) =>
    request<{ ok: boolean }>(`/api/datasets/${id}`, { method: 'DELETE' }),
  artifacts: (projectId?: number | null) =>
    request<Artifact[]>(`/api/artifacts${projectQuery(projectId)}`),
  artifactUsage: (projectId?: number | null) =>
    request<ArtifactUsage>(`/api/artifacts/usage${projectQuery(projectId)}`),
  artifactDownloadUrl: (id: number) =>
    request<{ artifact_id: number; url: string; expires_in_seconds: number }>(
      `/api/artifacts/${id}/download-url`,
    ),
  deleteArtifact: (id: number) =>
    request<{ ok: boolean }>(`/api/artifacts/${id}`, { method: 'DELETE' }),
  cacheStats: (projectId?: number | null) =>
    request<{ project_id: number | null; entries: number; size_bytes: number; hits: number }>(
      `/api/artifacts/cache/stats${projectQuery(projectId)}`,
    ),
  clearCache: (projectId?: number | null) =>
    request<{ ok: boolean; removed: number }>(
      `/api/artifacts/cache${projectQuery(projectId)}`,
      { method: 'DELETE' },
    ),
};
