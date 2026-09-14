import { useCallback, useEffect } from 'react';
import { workflowsApi } from '../../../../../features/workflow/api/workflowsApi';
import type { Workflow } from '../../../../../shared/types';
import { ApiError } from '../../../../../shared/api/httpClient';
import type { useWorkflowMetadata } from './useWorkflowMetadata';
import type { WorkflowPersistenceOptions } from './types';
type Snapshot = {
    name: string;
    graph: Record<string, unknown>;
    project_id: number;
};
export function useAutosave(o: WorkflowPersistenceOptions, m: ReturnType<typeof useWorkflowMetadata>, snapshot: Snapshot, signature: string) {
    const persistSnapshot = useCallback((next: Snapshot, nextSignature: string, sessionId = m.editorSessionRef.current): Promise<Workflow> => { const execute = async () => { if (sessionId !== m.editorSessionRef.current)
        throw new Error('AUTOSAVE_SUPERSEDED'); if (!next.name)
        throw new Error('نام جریان را وارد کنید'); m.setAutosaveState('saving'); try {
        const id = m.workflowIdRef.current;
        const saved = id ? await workflowsApi.autosave(id, { ...next, base_revision: m.workflowRevisionRef.current }) : await workflowsApi.create(next);
        if (sessionId !== m.editorSessionRef.current)
            return saved;
        m.adoptWorkflow(saved);
        m.lastSavedSignatureRef.current = nextSignature;
        m.skipNextAutosaveRef.current = false;
        return saved;
    }
    catch (error) {
        if (sessionId !== m.editorSessionRef.current || (error instanceof Error && error.message === 'AUTOSAVE_SUPERSEDED'))
            throw error;
        if (error instanceof ApiError && error.code === 'WORKFLOW_REVISION_CONFLICT') {
            m.setAutosaveState('conflict');
            o.setMessage('این جریان در نشست دیگری تغییر کرده است. برای جلوگیری از بازنویسی، جریان را دوباره بارگذاری کنید.');
        }
        else {
            m.setAutosaveState('error');
            o.setMessage(error instanceof Error ? error.message : 'ذخیره خودکار ناموفق بود');
        }
        throw error;
    } }; const queued = m.autosaveQueueRef.current.catch(() => undefined).then(execute); m.autosaveQueueRef.current = queued.catch(() => undefined); return queued; }, [m.adoptWorkflow, m.autosaveQueueRef, m.editorSessionRef, m.lastSavedSignatureRef, m.setAutosaveState, m.skipNextAutosaveRef, m.workflowIdRef, m.workflowRevisionRef, o.setMessage]);
    useEffect(() => { if (o.versionPreview || o.paused || !snapshot.name)
        return; if (m.skipNextAutosaveRef.current) {
        m.skipNextAutosaveRef.current = false;
        m.lastSavedSignatureRef.current = signature;
        return;
    } if (signature === m.lastSavedSignatureRef.current)
        return; m.setAutosaveState((s) => s === 'saving' ? s : 'idle'); const session = m.editorSessionRef.current; const timer = window.setTimeout(() => { void persistSnapshot(snapshot, signature, session).catch((e) => { if (e instanceof Error && e.message === 'AUTOSAVE_SUPERSEDED')
        return; }); }, 900); return () => window.clearTimeout(timer); }, [m.editorSessionRef, m.lastSavedSignatureRef, m.setAutosaveState, m.skipNextAutosaveRef, o.paused, o.versionPreview, persistSnapshot, signature, snapshot]);
    return persistSnapshot;
}
