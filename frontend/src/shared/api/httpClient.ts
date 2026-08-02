import { authTokenStorage } from '../auth/tokenStorage';

export const API_URL = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
export const jsonHeaders = { 'Content-Type': 'application/json' } as const;

export class ApiError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly requestId: string;
  readonly status: number;

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
  | { success: true; data: T; meta?: Record<string, unknown>; request_id?: string }
  | { success: false; error: { code?: string; message?: string; details?: Record<string, unknown> }; request_id?: string };

export type RequestOptions = RequestInit & {
  timeoutMs?: number;
  skipAuth?: boolean;
};

const unauthorizedListeners = new Set<() => void>();

export function onUnauthorized(listener: () => void) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function notifyUnauthorized() {
  authTokenStorage.clear();
  unauthorizedListeners.forEach((listener) => listener());
}

function isEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return Boolean(value && typeof value === 'object' && 'success' in value);
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json().catch(() => null);
  return response.text().catch(() => '');
}

export function projectQuery(projectId?: number | null) {
  return projectId ? `?project_id=${projectId}` : '';
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 30_000, skipAuth = false, signal: callerSignal, ...requestInit } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

  const headers = new Headers(requestInit.headers);
  const token = authTokenStorage.read();
  if (token && !skipAuth) headers.set('Authorization', `Bearer ${token}`);

  try {
    const response = await fetch(`${API_URL}${path}`, { ...requestInit, headers, signal: controller.signal });
    const payload = await parseResponse(response);

    if (response.status === 401 && !skipAuth) notifyUnauthorized();

    if (isEnvelope<T>(payload)) {
      if (payload.success) return payload.data;
      throw new ApiError(payload.error.message || 'Request failed', {
        code: payload.error.code,
        details: payload.error.details,
        requestId: payload.request_id,
        status: response.status,
      });
    }

    if (!response.ok) {
      const legacy = payload && typeof payload === 'object' ? payload as { detail?: unknown; message?: unknown; code?: unknown } : null;
      throw new ApiError(String(legacy?.detail || legacy?.message || response.statusText || 'Request failed'), {
        code: String(legacy?.code || 'REQUEST_FAILED'),
        status: response.status,
        requestId: response.headers.get('x-request-id') || '',
      });
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      const timeoutAbort = controller.signal.reason instanceof DOMException && controller.signal.reason.name === 'TimeoutError';
      throw new ApiError(timeoutAbort ? 'Request timed out' : 'Request cancelled', {
        code: timeoutAbort ? 'REQUEST_TIMEOUT' : 'REQUEST_CANCELLED',
      });
    }
    throw new ApiError(error instanceof Error ? error.message : 'Network request failed', { code: 'NETWORK_ERROR' });
  } finally {
    window.clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function downloadFile(path: string, filename: string, options: RequestOptions = {}) {
  const token = authTokenStorage.read();
  const headers = new Headers(options.headers);
  if (token && !options.skipAuth) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) throw new ApiError(response.statusText || 'Download failed', { status: response.status });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const getAuthToken = () => authTokenStorage.read();
export const setAuthToken = (token: string) => authTokenStorage.write(token);
export const clearAuthToken = () => authTokenStorage.clear();
