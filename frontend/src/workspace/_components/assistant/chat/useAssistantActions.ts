import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { assistantApi } from '../../../../features/assistant/api/assistantApi';
import { createMessageId, type ChatMessage } from './model';
type Options = {
    workflowId: number | null;
    draft: string;
    messages: ChatMessage[];
    blocked: boolean;
    onWorkflowChanged?: () => void | Promise<void>;
    setDraft: Dispatch<SetStateAction<string>>;
    setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
    setBusy: Dispatch<SetStateAction<boolean>>;
    setClearing: Dispatch<SetStateAction<boolean>>;
    setError: Dispatch<SetStateAction<string>>;
};
export function useAssistantActions(options: Options) {
    const { workflowId, draft, messages, blocked, onWorkflowChanged, setDraft, setMessages, setBusy, setClearing, setError } = options;
    const send = useCallback(async () => {
        const content = draft.trim();
        if (!workflowId || !content || blocked)
            return;
        const userMessage: ChatMessage = { id: createMessageId(), role: 'user', content };
        setMessages((current) => [...current, userMessage]);
        setDraft('');
        setError('');
        setBusy(true);
        try {
            const response = await assistantApi.chat({ message: content, workflow_id: workflowId });
            setMessages((current) => [...current, { id: createMessageId(), role: 'assistant', content: response.message }]);
            if (response.workflow_changed)
                await onWorkflowChanged?.();
        }
        catch (error) {
            setMessages((current) => current.filter((message) => message.id !== userMessage.id));
            setDraft(content);
            setError(error instanceof Error ? error.message : 'ارسال درخواست به دستیار هوشمند ناموفق بود.');
        }
        finally {
            setBusy(false);
        }
    }, [blocked, draft, onWorkflowChanged, setBusy, setDraft, setError, setMessages, workflowId]);
    const clear = useCallback(async () => {
        if (!workflowId || !messages.length || blocked)
            return;
        setClearing(true);
        setError('');
        try {
            await assistantApi.clearHistory(workflowId);
            setMessages([]);
        }
        catch (error) {
            setError(error instanceof Error ? error.message : 'پاک کردن تاریخچه گفتگو ناموفق بود.');
        }
        finally {
            setClearing(false);
        }
    }, [blocked, messages.length, setClearing, setError, setMessages, workflowId]);
    return { send, clear };
}
