import { useCallback } from 'react';
import { runsApi } from '../../../../../features/execution/api/runsApi';
import { normalizeEdgeHandles } from '../../../../_model/graph';
import { executionErrorMessage } from './errorMessage';
import type { WorkflowExecutionOptions } from './types';
export function useRunGraph(o: WorkflowExecutionOptions) { return useCallback(async (nodeId: string | null) => { if (o.versionPreviewActive) {
    o.setMessage('برای اجرا، نسخه ذخیره‌شده را بازیابی کنید یا به آخرین نسخه خودکار برگردید.');
    return;
} if (o.componentEditorActive) {
    o.setMessage('ابتدا نسخه کامپوننت را ذخیره کنید و به جریان اصلی برگردید.');
    return;
} const latest = o.getExecutionSnapshot(); const edges = normalizeEdgeHandles(latest.nodes, latest.edges); if (nodeId) {
    o.setSelectedId(nodeId);
    o.setSelectedIds([nodeId]);
    o.setSelectedEdgeId(null);
    o.setSelectedEdgeIds([]);
} o.setMessage('در حال تثبیت آخرین تغییرات جریان…'); try {
    const saved = await o.persistSnapshot(latest.autosaveSnapshot, latest.autosaveSignature);
    o.setBusy(true);
    o.setMessage(nodeId ? 'جریان متصل به نود انتخاب‌شده اجرا می‌شود' : 'کل برد اجرا می‌شود');
    const run = await runsApi.create({ workflow_name: o.workflowName, workflow_graph: { nodes: latest.nodes, edges, meta: { datasetId: o.datasetId, targetColumn: o.targetColumn, taskType: o.taskType } }, workflow_id: saved.id, workflow_revision: saved.revision, selected_node_id: nodeId, bypass_cache: false, dataset_id: o.datasetId, project_id: o.projectId, target_column: o.targetColumn, task_type: o.taskType || 'auto', idempotency_key: crypto.randomUUID() });
    o.recordRun(run);
    o.setLastRunSignature(latest.currentOutputSignature);
    o.setMessage('جریان در صف اجرا قرار گرفت');
}
catch (error) {
    if (!(error instanceof Error && error.message === 'AUTOSAVE_SUPERSEDED'))
        o.setMessage(executionErrorMessage(error));
    o.setBusy(false);
} }, [o.componentEditorActive, o.datasetId, o.getExecutionSnapshot, o.persistSnapshot, o.projectId, o.recordRun, o.setBusy, o.setLastRunSignature, o.setMessage, o.setSelectedEdgeId, o.setSelectedEdgeIds, o.setSelectedId, o.setSelectedIds, o.targetColumn, o.taskType, o.versionPreviewActive, o.workflowName]); }
