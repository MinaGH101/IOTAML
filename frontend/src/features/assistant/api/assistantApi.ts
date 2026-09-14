import { jsonHeaders, request } from '../../../shared/api/httpClient';

export type AssistantHistoryMessage = {
  id: number;
  workflow_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export const assistantApi = {
  chat: (
    payload: { message: string; workflow_id?: number | null },
    signal?: AbortSignal,
  ) => request<{ message: string }>('/api/assistant/chat', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
    signal,
    timeoutMs: 60_000,
  }),

  history: (workflowId: number, signal?: AbortSignal) =>
    request<AssistantHistoryMessage[]>(
      `/api/assistant/history/${workflowId}?limit=1000`,
      { signal },
    ),

  clearHistory: (workflowId: number, signal?: AbortSignal) =>
    request<{ ok: boolean; deleted: number }>(
      `/api/assistant/history/${workflowId}`,
      { method: 'DELETE', signal },
    ),
};
