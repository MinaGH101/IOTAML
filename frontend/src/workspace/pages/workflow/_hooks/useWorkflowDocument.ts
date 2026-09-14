import { useWorkflowPersistence } from './useWorkflowPersistence';
import { useWorkflowVersions } from './useWorkflowVersions';
import { useDocumentGraph } from './workflow-document/useDocumentGraph';
import { useDocumentLoader } from './workflow-document/useDocumentLoader';
import { useDocumentRecords } from './workflow-document/useDocumentRecords';
import type { UseWorkflowDocumentOptions } from './workflow-document/types';
export function useWorkflowDocument(o: UseWorkflowDocumentOptions) {
    const applyGraph = useDocumentGraph(o);
    const persistence = useWorkflowPersistence({ projectId: o.projectId, nodes: o.nodes, edges: o.edges, datasetId: o.datasetId, targetColumn: o.targetColumn, taskType: o.taskType,
        serializedBoards: o.serializedBoards, analysisBoardSignature: o.analysisBoardSignature, activeBoardId: o.activeBoardId, versionPreview: o.versionPreview, paused: o.autosavePaused, setMessage: o.setMessage });
    const versions = useWorkflowVersions({ catalog: o.catalog, persistence, workflowLastRunId: o.workflowLastRunId, setWorkflowLastRunId: o.setWorkflowLastRunId,
        setCurrentRun: o.setCurrentRun, setNodeStateRun: o.setNodeStateRun, setLastRunSignature: o.setLastRunSignature, versionPreview: o.versionPreview,
        setVersionPreview: o.setVersionPreview, applyGraph, setMessage: o.setMessage });
    const records = useDocumentRecords(o, persistence, versions, applyGraph);
    const loadWorkflow = useDocumentLoader(o, persistence, records);
    return { currentWorkflowId: persistence.currentWorkflowId, workflowName: persistence.workflowName, setWorkflowName: persistence.setWorkflowName,
        workflowVersions: versions.items, selectedVersionId: versions.selectedId, autosaveState: persistence.autosaveState, autosaveUpdatedAt: persistence.autosaveUpdatedAt,
        autosaveLabel: persistence.autosaveLabel, versionBusy: versions.busy, versionDialogOpen: versions.dialogOpen, setVersionDialogOpen: versions.setDialogOpen,
        currentGraph: persistence.currentGraph, currentOutputSignature: persistence.currentOutputSignature, autosaveSnapshot: persistence.autosaveSnapshot,
        autosaveSignature: persistence.autosaveSignature, persistSnapshot: persistence.persistSnapshot, refreshWorkflowVersions: versions.refresh, loadWorkflow,
        saveVersion: versions.save, viewVersion: versions.view, returnToCurrentVersion: versions.returnToCurrent, restoreVersion: versions.restore,
        deleteVersion: versions.remove, exportCurrent: persistence.exportCurrent };
}
