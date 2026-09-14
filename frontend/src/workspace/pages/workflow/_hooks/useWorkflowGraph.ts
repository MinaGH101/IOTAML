import { useRef } from 'react';
import { createWorkflowGraphStore } from '../../../../features/workflow/model/workflowGraphStore';
import { useWorkflowGraphActions } from './workflow-graph/useWorkflowGraphActions';
import { useWorkflowGraphKeyboard } from './workflow-graph/useWorkflowGraphKeyboard';
import { useWorkflowGraphState } from './workflow-graph/useWorkflowGraphState';
export function useWorkflowGraph({ readOnly }: {
    readOnly: boolean;
}) {
    const storeRef = useRef<ReturnType<typeof createWorkflowGraphStore> | null>(null);
    if (!storeRef.current)
        storeRef.current = createWorkflowGraphStore();
    const store = storeRef.current;
    const state = useWorkflowGraphState(store);
    const actions = useWorkflowGraphActions(store, readOnly);
    useWorkflowGraphKeyboard(store, actions.deleteSelected);
    return { ...state, ...actions };
}
