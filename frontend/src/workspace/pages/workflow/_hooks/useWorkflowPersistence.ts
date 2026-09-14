import { useCallback } from 'react';
import { exportWorkflowJson } from '../../../../shared/lib/workflowJson';
import { useAutosave } from './workflow-persistence/useAutosave';
import { useWorkflowMetadata } from './workflow-persistence/useWorkflowMetadata';
import { useWorkflowSnapshot } from './workflow-persistence/useWorkflowSnapshot';
import type { WorkflowPersistenceOptions } from './workflow-persistence/types';
export function useWorkflowPersistence(o: WorkflowPersistenceOptions) { const m = useWorkflowMetadata(); const s = useWorkflowSnapshot(o, m.workflowName); const persistSnapshot = useAutosave(o, m, s.autosaveSnapshot, s.autosaveSignature); const exportCurrent = useCallback(() => { if (o.paused) {
    o.setMessage('ابتدا ویرایش کامپوننت را ذخیره کنید و به جریان اصلی برگردید.');
    return;
} exportWorkflowJson(m.workflowName, s.currentGraph); o.setMessage('فایل JSON جریان دانلود شد'); }, [m.workflowName, o.paused, o.setMessage, s.currentGraph]); const autosaveLabel = o.versionPreview ? `نسخه v${o.versionPreview.version_number}` : m.autosaveState === 'saving' ? 'در حال ذخیره…' : m.autosaveState === 'conflict' ? 'تداخل ذخیره' : m.autosaveState === 'error' ? 'خطای ذخیره' : m.autosaveState === 'idle' ? 'تغییرات ذخیره‌نشده' : `ذخیره خودکار · r${m.workflowRevision}`; return { ...m, ...s, autosaveLabel, persistSnapshot, exportCurrent }; }
export type WorkflowPersistenceController = ReturnType<typeof useWorkflowPersistence>;
