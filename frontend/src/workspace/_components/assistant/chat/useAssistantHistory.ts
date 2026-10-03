import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { assistantApi } from '../../../../features/assistant/api/assistantApi';
import { ASSISTANT_ERROR_MESSAGE } from '../../../../shared/lib/errorMessages';
import type { ChatMessage } from './model';
export function useAssistantHistory(workflowId: number | null, setMessages: Dispatch<SetStateAction<ChatMessage[]>>, setError: Dispatch<SetStateAction<string>>, setLoading: Dispatch<SetStateAction<boolean>>) {
    useEffect(() => {
        if (!workflowId) {
            setMessages([]);
            setError('');
            setLoading(false);
            return undefined;
        }
        const controller = new AbortController();
        setLoading(true);
        setError('');
        assistantApi.history(workflowId, controller.signal)
            .then((history) => {
            if (controller.signal.aborted)
                return;
            setMessages(history.map((message) => ({
                id: `assistant-history-${message.id}`,
                role: message.role,
                content: message.content,
            })));
        })
            .catch(() => {
            if (controller.signal.aborted)
                return;
            setMessages([]);
            setError(ASSISTANT_ERROR_MESSAGE);
        })
            .finally(() => { if (!controller.signal.aborted)
            setLoading(false); });
        return () => controller.abort();
    }, [setError, setLoading, setMessages, workflowId]);
}
