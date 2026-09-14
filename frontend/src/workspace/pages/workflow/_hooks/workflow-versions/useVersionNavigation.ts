import { useCallback } from 'react';
import { workflowsApi } from '../../../../../features/workflow/api/workflowsApi';
import { runsApi } from '../../../../../features/execution/api/runsApi';
import type { Run, Workflow, WorkflowVersionSummary } from '../../../../../shared/types';
import type { FlowGraph } from '../../../../_model/graph';
import type { WorkflowVersionsOptions } from './types';
export function useVersionNavigation(o: WorkflowVersionsOptions, setSelectedId: (id: number | null) => void, setBusy: (v: boolean) => void, refresh: (id?: number | null) => Promise<WorkflowVersionSummary[]>) {
    const activate = useCallback(async (workflow: Workflow, lastRun: Run | null) => { o.persistence.adoptWorkflow(workflow); o.setVersionPreview(null); setSelectedId(null); o.applyGraph(workflow.graph as unknown as FlowGraph, o.catalog.nodes, o.catalog.aliases); o.setCurrentRun(lastRun); o.setNodeStateRun(lastRun); o.setWorkflowLastRunId(workflow.last_run_id ?? null); o.setLastRunSignature(''); }, [o.applyGraph, o.catalog.aliases, o.catalog.nodes, o.persistence.adoptWorkflow, o.setCurrentRun, o.setLastRunSignature, o.setNodeStateRun, o.setVersionPreview, o.setWorkflowLastRunId, setSelectedId]);
    const view = useCallback(async (summary: WorkflowVersionSummary) => { const id = o.persistence.getWorkflowId(); if (!id)
        return; setBusy(true); try {
        if (!o.versionPreview && o.persistence.autosaveSnapshot.name)
            await o.persistence.persistSnapshot(o.persistence.autosaveSnapshot, o.persistence.autosaveSignature);
        const version = await workflowsApi.getVersion(id, summary.id);
        const run = version.run_id ? await runsApi.get(version.run_id).catch(() => null) : null;
        o.setVersionPreview(version);
        setSelectedId(version.id);
        o.applyGraph(version.graph as unknown as FlowGraph, o.catalog.nodes, o.catalog.aliases);
        o.setCurrentRun(run);
        o.setNodeStateRun(run);
        o.setLastRunSignature('');
        o.setMessage(`نسخه «${version.name}» فقط برای مشاهده باز شد`);
    }
    catch (e) {
        o.setMessage(e instanceof Error ? e.message : 'دریافت نسخه ناموفق بود');
    }
    finally {
        setBusy(false);
    } }, [o.applyGraph, o.catalog.aliases, o.catalog.nodes, o.persistence.autosaveSignature, o.persistence.autosaveSnapshot, o.persistence.getWorkflowId, o.persistence.persistSnapshot, o.setCurrentRun, o.setLastRunSignature, o.setMessage, o.setNodeStateRun, o.setVersionPreview, o.versionPreview, setBusy, setSelectedId]);
    const returnToCurrent = useCallback(async () => { const id = o.persistence.getWorkflowId(); if (!id)
        return; setBusy(true); try {
        const w = await workflowsApi.get(id);
        const run = w.last_run_id ? await runsApi.get(w.last_run_id).catch(() => null) : null;
        await activate(w, run);
        o.setMessage('آخرین نسخه خودکار نمایش داده شد');
    }
    catch (e) {
        o.setMessage(e instanceof Error ? e.message : 'بازگشت به نسخه جاری ناموفق بود');
    }
    finally {
        setBusy(false);
    } }, [activate, o.persistence.getWorkflowId, o.setMessage, setBusy]);
    const restore = useCallback(async (v: WorkflowVersionSummary) => { const id = o.persistence.getWorkflowId(); if (!id || !window.confirm(`نسخه «${v.name}» جایگزین پیش‌نویس جاری شود؟`))
        return; setBusy(true); try {
        const w = await workflowsApi.restoreVersion(id, v.id);
        const run = w.last_run_id ? await runsApi.get(w.last_run_id).catch(() => null) : null;
        await activate(w, run);
        await refresh(id);
        o.setMessage(`نسخه «${v.name}» بازیابی شد`);
    }
    catch (e) {
        o.setMessage(e instanceof Error ? e.message : 'بازیابی نسخه ناموفق بود');
    }
    finally {
        setBusy(false);
    } }, [activate, o.persistence.getWorkflowId, o.setMessage, refresh, setBusy]);
    return { activate, view, returnToCurrent, restore };
}
