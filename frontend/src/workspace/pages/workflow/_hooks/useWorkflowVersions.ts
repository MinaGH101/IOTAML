import { useCallback, useState } from 'react';
import { workflowsApi } from '../../../../features/workflow/api/workflowsApi';
import type { WorkflowVersionSummary } from '../../../../shared/types';
import { useVersionMutations } from './workflow-versions/useVersionMutations';
import { useVersionNavigation } from './workflow-versions/useVersionNavigation';
import type { WorkflowVersionsOptions } from './workflow-versions/types';
export function useWorkflowVersions(o: WorkflowVersionsOptions) { const [items, setItems] = useState<WorkflowVersionSummary[]>([]); const [selectedId, setSelectedId] = useState<number | null>(null); const [busy, setBusy] = useState(false); const [dialogOpen, setDialogOpen] = useState(false); const initialize = useCallback((v: WorkflowVersionSummary[]) => { setItems(v); setSelectedId(null); o.setVersionPreview(null); }, [o.setVersionPreview]); const refresh = useCallback(async (id = o.persistence.getWorkflowId()) => { if (!id) {
    setItems([]);
    return [];
} const v = await workflowsApi.versions(id); setItems(v); return v; }, [o.persistence.getWorkflowId]); const nav = useVersionNavigation(o, setSelectedId, setBusy, refresh); const mutations = useVersionMutations(o, setSelectedId, setBusy, setDialogOpen, refresh, nav.activate); return { items, selectedId, busy, dialogOpen, setDialogOpen, initialize, refresh, save: mutations.save, view: nav.view, returnToCurrent: nav.returnToCurrent, restore: nav.restore, remove: mutations.remove }; }
export type WorkflowVersionsController = ReturnType<typeof useWorkflowVersions>;
