import { useMemo, useState } from 'react';
import { useAssistantActions } from './chat/useAssistantActions';
import { useAssistantHistory } from './chat/useAssistantHistory';
import type { ChatMessage } from './chat/model';
export type { ChatMessage } from './chat/model';
export function useAssistantChat(workflowId: number | null, onWorkflowChanged?: () => void | Promise<void>) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [clearingHistory, setClearingHistory] = useState(false);
    const [error, setError] = useState('');
    useAssistantHistory(workflowId, setMessages, setError, setLoadingHistory);
    const blocked = busy || loadingHistory || clearingHistory;
    const canSend = useMemo(() => Boolean(workflowId && draft.trim()) && !blocked, [blocked, draft, workflowId]);
    const { send, clear } = useAssistantActions({
        workflowId, draft, messages, blocked, onWorkflowChanged, setDraft, setMessages, setBusy, setClearing: setClearingHistory, setError,
    });
    return { messages, draft, setDraft, busy, loadingHistory, clearingHistory, error, canSend, send, clear };
}
