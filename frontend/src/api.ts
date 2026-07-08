import type { Dataset, LoginResponse, Project, ProjectPayload, RegistryNode, Run, UserProfile, Workflow, WorkflowValidationResult } from './types';

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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || 'Request failed');
  }
  return res.json() as Promise<T>;
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
  datasets: (projectId?: number | null) => request<Dataset[]>(`/api/datasets${projectQuery(projectId)}`),
  uploadDataset: async (file: File, projectId?: number | null) => {
    const body = new FormData();
    body.append('file', file);
    if (projectId) body.append('project_id', String(projectId));
    return request<Dataset>('/api/datasets/upload', { method: 'POST', body });
  },
  deleteDataset: (id: number) => request<{ ok: boolean }>(`/api/datasets/${id}`, { method: 'DELETE' }),
  workflows: (projectId?: number | null) => request<Workflow[]>(`/api/workflows${projectQuery(projectId)}`),
  createWorkflow: (payload: { name: string; graph: Record<string, unknown>; project_id?: number | null }) =>
    request<Workflow>('/api/workflows', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  updateWorkflow: (id: number, payload: { name: string; graph: Record<string, unknown>; project_id?: number | null }) =>
    request<Workflow>(`/api/workflows/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(payload) }),
  getWorkflow: (id: number) => request<Workflow>(`/api/workflows/${id}`),
  validateWorkflow: (graph: Record<string, unknown>) =>
    request<WorkflowValidationResult>('/api/workflows/validate', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ graph }) }),
  createRun: (payload: Record<string, unknown>) =>
    request<Run>('/api/runs', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }),
  getRun: (id: number) => request<Run>(`/api/runs/${id}`),
  runProgress: (id: number) => request<Record<string, unknown>>(`/api/runs/${id}/progress`),
  nodePreview: (runId: number, nodeId: string) => request<Record<string, unknown>>(`/api/runs/${runId}/nodes/${nodeId}/preview`),
  cancelRun: (id: number) => request<{ ok: boolean; status: string }>(`/api/runs/${id}/cancel`, { method: 'POST' }),
  listRuns: (projectId?: number | null) => request<Run[]>(`/api/runs${projectQuery(projectId)}`)
};
