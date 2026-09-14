import { useCallback, useEffect } from 'react';
import { nodesApi } from '../../../../../features/custom-nodes/api/nodesApi';
import { runsApi } from '../../../../../features/execution/api/runsApi';
import { workflowsApi } from '../../../../../features/workflow/api/workflowsApi';
import { ApiError } from '../../../../../shared/api/httpClient';
import type { WorkflowVersionSummary } from '../../../../../shared/types';
import type { FlowGraph } from '../../../../_model/graph';
import type { useWorkflowPersistence } from '../useWorkflowPersistence';
import type { UseWorkflowDocumentOptions } from './types';
import type { useDocumentRecords } from './useDocumentRecords';
export function useDocumentLoader(o: UseWorkflowDocumentOptions, persistence: ReturnType<typeof useWorkflowPersistence>, records: ReturnType<typeof useDocumentRecords>) {
    useEffect(() => {
        let alive = true;
        Promise.all([nodesApi.catalog(o.projectId), o.refreshDatasets(), runsApi.list(o.projectId)]).then(async ([catalog, datasets, runs]) => {
            if (!alive)
                return;
            o.setCatalog(catalog);
            o.setRunHistory(runs);
            const fallback = datasets[0]?.id ?? null;
            o.setDatasetId(fallback);
            if (!o.initialWorkflowId) {
                records.resetDocument(catalog.nodes, catalog.aliases, fallback);
                return;
            }
            const workflow = await workflowsApi.get(o.initialWorkflowId);
            const [versions, lastRun] = await Promise.all([
                workflowsApi.versions(workflow.id).catch(() => [] as WorkflowVersionSummary[]), workflow.last_run_id ? runsApi.get(workflow.last_run_id).catch(() => null) : Promise.resolve(null)
            ]);
            if (!alive)
                return;
            records.loadRecord(workflow, versions, lastRun, catalog.nodes, catalog.aliases);
            if ((workflow.graph as unknown as FlowGraph).meta?.datasetId == null)
                o.setDatasetId(fallback);
            o.setMessage('جریان بارگذاری شد');
        }).catch((error) => { if (alive)
            o.setMessage(error instanceof Error ? error.message : 'بارگذاری پروژه ناموفق بود'); });
        return () => { alive = false; };
    }, [o.initialWorkflowId, o.projectId, o.refreshDatasets, o.setCatalog, o.setDatasetId, o.setMessage, o.setRunHistory, records.loadRecord, records.resetDocument]);
    return useCallback(async (value: string) => {
        const id = Number(value) || null;
        if (!id)
            return;
        try {
            if (!o.versionPreview && persistence.autosaveSnapshot.name)
                await persistence.persistSnapshot(persistence.autosaveSnapshot, persistence.autosaveSignature).catch((error) => { if (error instanceof ApiError && error.code === 'WORKFLOW_REVISION_CONFLICT')
                    throw error; });
            persistence.supersedeSession();
            const workflow = await workflowsApi.get(id);
            const [versions, lastRun] = await Promise.all([workflowsApi.versions(id), workflow.last_run_id ? runsApi.get(workflow.last_run_id).catch(() => null) : Promise.resolve(null)]);
            records.loadRecord(workflow, versions, lastRun, o.catalog.nodes, o.catalog.aliases);
            o.setMessage('جریان بارگذاری شد');
        }
        catch (error) {
            o.setMessage(error instanceof Error ? error.message : 'بارگذاری ناموفق بود');
        }
    }, [o.catalog.aliases, o.catalog.nodes, o.setMessage, o.versionPreview, persistence.autosaveSignature, persistence.autosaveSnapshot, persistence.persistSnapshot, persistence.supersedeSession, records.loadRecord]);
}
