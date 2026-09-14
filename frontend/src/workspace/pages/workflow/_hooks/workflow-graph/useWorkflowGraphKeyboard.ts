import { useEffect } from 'react';
import type { createWorkflowGraphStore } from '../../../../../features/workflow/model/workflowGraphStore';
import { isTextInput } from '../../../../_model/graph';
type Store = ReturnType<typeof createWorkflowGraphStore>;
export function useWorkflowGraphKeyboard(store: Store, deleteSelected: () => void) {
    useEffect(() => {
        const updateModifier = (event: KeyboardEvent) => store.getState().setCtrlSelectionActive(event.ctrlKey || event.metaKey);
        const clearModifier = () => store.getState().setCtrlSelectionActive(false);
        window.addEventListener('keydown', updateModifier);
        window.addEventListener('keyup', updateModifier);
        window.addEventListener('blur', clearModifier);
        return () => {
            window.removeEventListener('keydown', updateModifier);
            window.removeEventListener('keyup', updateModifier);
            window.removeEventListener('blur', clearModifier);
        };
    }, [store]);
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if ((event.key === 'Delete' || event.key === 'Backspace') && !isTextInput(event.target))
                deleteSelected();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [deleteSelected]);
}
