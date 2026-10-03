import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { assistantApi } from '../../../../features/assistant/api/assistantApi';
import { ASSISTANT_ERROR_MESSAGE } from '../../../../shared/lib/errorMessages';
import { createMessageId, type ChatMessage } from './model';
type Options = {
    workflowId: number | null;
    draft: string;
    messages: ChatMessage[];
    blocked: boolean;
    prepareWorkflow?: () => void | Promise<void>;
    onWorkflowChanged?: () => void | Promise<void>;
    onRunCreated?: (runId: number) => void | Promise<void>;
    setDraft: Dispatch<SetStateAction<string>>;
    setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
    setBusy: Dispatch<SetStateAction<boolean>>;
    setClearing: Dispatch<SetStateAction<boolean>>;
    setError: Dispatch<SetStateAction<string>>;
};
export function useAssistantActions(options: Options) {
    const { workflowId, draft, messages, blocked, prepareWorkflow, onWorkflowChanged, onRunCreated, setDraft, setMessages, setBusy, setClearing, setError } = options;
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
            await prepareWorkflow?.();
            const response = await assistantApi.chat({ message: content, workflow_id: workflowId });
            setMessages((current) => [...current, { id: createMessageId(), role: 'assistant', content: response.message }]);
            if (response.workflow_changed)
                await onWorkflowChanged?.();
            if (response.run_id !== null)
                await onRunCreated?.(response.run_id);
        }
        catch {
            setMessages((current) => current.filter((message) => message.id !== userMessage.id));
            setDraft(content);
            setError(ASSISTANT_ERROR_MESSAGE);
        }
        finally {
            setBusy(false);
        }
    }, [blocked, draft, onRunCreated, onWorkflowChanged, prepareWorkflow, setBusy, setDraft, setError, setMessages, workflowId]);
    const clear = useCallback(async () => {
        if (!workflowId || !messages.length || blocked)
            return;
        setClearing(true);
        setError('');
        try {
            await assistantApi.clearHistory(workflowId);
            setMessages([]);
        }
        catch {
            setError(ASSISTANT_ERROR_MESSAGE);
        }
        finally {
            setClearing(false);
        }
    }, [blocked, messages.length, setClearing, setError, setMessages, workflowId]);
    return { send, clear };
}
