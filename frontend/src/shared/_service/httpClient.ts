export const API_URL = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
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

  constructor(
    message: string,
    options: {
      code?: string;
      details?: Record<string, unknown>;
      requestId?: string;
      status?: number;
    } = {},
  ) {
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
  | {
      success: false;
      error: { code: string; message: string; details: Record<string, unknown> };
      request_id: string;
    };

export const jsonHeaders = { 'Content-Type': 'application/json' };

export function projectQuery(projectId?: number | null) {
  return projectId ? `?project_id=${projectId}` : '';
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | T | null;

  if (payload && typeof payload === 'object' && 'success' in payload) {
    if (payload.success) return payload.data;
    throw new ApiError(payload.error.message || 'Request failed', {
      code: payload.error.code,
      details: payload.error.details,
      requestId: payload.request_id,
      status: response.status,
    });
  }

  if (!response.ok) {
    const legacy = payload as { detail?: string } | null;
    throw new ApiError(legacy?.detail || response.statusText || 'Request failed', {
      status: response.status,
    });
  }
  return payload as T;
}
