import { jsonHeaders, request } from '../../../shared/api/httpClient';

export const assistantApi = {
  chat: (payload: { message: string; workflow_id?: number | null }, signal?: AbortSignal) => request<{ message: string }>('/api/assistant/chat', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload), signal, timeoutMs: 60_000 }),
};
