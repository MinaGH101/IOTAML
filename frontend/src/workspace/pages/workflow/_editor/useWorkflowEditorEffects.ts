import { useCallback, useEffect } from 'react';
import type { WorkflowEditorBase } from './useWorkflowEditorBase';
import type { WorkflowEditorDocument } from './useWorkflowEditorDocument';
export function useWorkflowEditorEffects(base: WorkflowEditorBase, data: WorkflowEditorDocument) {
    const { shell, runs } = base;
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
            event.preventDefault();
            shell.setAnalysisBoardOpen((value) => !value);
        } };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [shell.setAnalysisBoardOpen]);
    useEffect(() => {
        const mobile = window.matchMedia('(max-width: 760px)');
        const collapsePanels = () => { if (!mobile.matches)
            return; shell.setPaletteCollapsed(true); shell.setResultsCollapsed(true); };
        collapsePanels();
        mobile.addEventListener('change', collapsePanels);
        return () => mobile.removeEventListener('change', collapsePanels);
    }, [shell.setPaletteCollapsed, shell.setResultsCollapsed]);
    const refreshVersions = useCallback(() => { void data.document.refreshWorkflowVersions().catch((error) => base.setMessage(error instanceof Error ? error.message : 'دریافت نسخه‌ها ناموفق بود')); }, [base.setMessage, data.document.refreshWorkflowVersions]);
    const refreshComponents = useCallback(() => { void data.components.refresh().catch((error) => base.setMessage(error instanceof Error ? error.message : 'دریافت کامپوننت‌ها ناموفق بود')); }, [base.setMessage, data.components.refresh]);
    const workflowDirtyForBoard = Boolean(runs.currentRun && runs.lastRunSignature && data.document.currentOutputSignature !== runs.lastRunSignature);
    return { refreshVersions, refreshComponents, workflowDirtyForBoard };
}
