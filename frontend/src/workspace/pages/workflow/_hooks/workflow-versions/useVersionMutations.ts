import { useCallback } from 'react';
import { workflowsApi } from '../../../../../features/workflow/api/workflowsApi';
import { runsApi } from '../../../../../features/execution/api/runsApi';
import type { WorkflowVersionSummary } from '../../../../../shared/types';
import type { WorkflowVersionsOptions } from './types';
export function useVersionMutations(o: WorkflowVersionsOptions, setSelectedId: (id: number | null) => void, setBusy: (v: boolean) => void, setDialogOpen: (v: boolean) => void, refresh: (id?: number | null) => Promise<WorkflowVersionSummary[]>, activate: (w: Awaited<ReturnType<typeof workflowsApi.get>>, run: Awaited<ReturnType<typeof runsApi.get>> | null) => Promise<void>) {
    const save = useCallback(async (name: string, description: string) => { if (o.versionPreview) {
        o.setMessage('ابتدا نسخه انتخاب‌شده را بازیابی کنید یا به آخرین نسخه خودکار برگردید.');
        return;
    } if (!o.persistence.workflowName.trim()) {
        o.setMessage('نام جریان را وارد کنید');
        return;
    } setBusy(true); try {
        const saved = await o.persistence.persistSnapshot(o.persistence.autosaveSnapshot, o.persistence.autosaveSignature);
        const v = await workflowsApi.createVersion(saved.id, { name, description, run_id: o.workflowLastRunId });
        setSelectedId(v.id);
        await refresh(saved.id);
        setDialogOpen(false);
        o.setMessage(`نسخه «${v.name}» ذخیره شد`);
    }
    catch (e) {
        if (!(e instanceof Error && e.message === 'AUTOSAVE_SUPERSEDED'))
            o.setMessage(e instanceof Error ? e.message : 'ذخیره نسخه ناموفق بود');
    }
    finally {
        setBusy(false);
    } }, [o.persistence.autosaveSignature, o.persistence.autosaveSnapshot, o.persistence.persistSnapshot, o.persistence.workflowName, o.setMessage, o.versionPreview, o.workflowLastRunId, refresh, setBusy, setDialogOpen, setSelectedId]);
    const remove = useCallback(async (v: WorkflowVersionSummary) => { const id = o.persistence.getWorkflowId(); if (!id || !window.confirm(`نسخه «${v.name}» حذف شود؟`))
        return; setBusy(true); try {
        await workflowsApi.removeVersion(id, v.id);
        if (o.versionPreview?.id === v.id) {
            const w = await workflowsApi.get(id);
            const run = w.last_run_id ? await runsApi.get(w.last_run_id).catch(() => null) : null;
            await activate(w, run);
        }
        await refresh(id);
        o.setMessage('نسخه حذف شد');
    }
    catch (e) {
        o.setMessage(e instanceof Error ? e.message : 'حذف نسخه ناموفق بود');
    }
    finally {
        setBusy(false);
    } }, [activate, o.persistence.getWorkflowId, o.setMessage, o.versionPreview?.id, refresh, setBusy]);
    return { save, remove };
}
