import { useCallback } from 'react';
import type { RegistryNode, Run, Workflow, WorkflowVersionSummary } from '../../../../../shared/types';
import { createMainAnalysisBoard, defaultGraph, MAIN_ANALYSIS_BOARD_ID, restoreWorkflowViewport, type FlowGraph } from '../../../../_model/graph';
import type { useWorkflowPersistence } from '../useWorkflowPersistence';
import type { useWorkflowVersions } from '../useWorkflowVersions';
import type { UseWorkflowDocumentOptions } from './types';
export function useDocumentRecords(o: UseWorkflowDocumentOptions, persistence: ReturnType<typeof useWorkflowPersistence>, versions: ReturnType<typeof useWorkflowVersions>, applyGraph: (graph: FlowGraph, registry: RegistryNode[], aliases: Record<string, string>) => void) {
    const loadRecord = useCallback((workflow: Workflow, items: WorkflowVersionSummary[], lastRun: Run | null, registry: RegistryNode[], aliases: Record<string, string>) => {
        persistence.adoptWorkflow(workflow);
        versions.initialize(items);
        applyGraph(workflow.graph as unknown as FlowGraph, registry, aliases);
        o.setCurrentRun(lastRun);
        o.setNodeStateRun(lastRun);
        o.setWorkflowLastRunId(workflow.last_run_id ?? null);
        o.setLastRunSignature('');
    }, [applyGraph, o.setCurrentRun, o.setLastRunSignature, o.setNodeStateRun, o.setWorkflowLastRunId, persistence.adoptWorkflow, versions.initialize]);
    const resetDocument = useCallback((registry: RegistryNode[], aliases: Record<string, string>, fallbackDatasetId: number | null) => {
        const graph = defaultGraph(registry, aliases);
        persistence.resetMetadata();
        versions.initialize([]);
        o.setNodes(graph.nodes);
        o.setEdges(graph.edges);
        o.setDatasetId(fallbackDatasetId);
        o.restoreWorkflowCanvasViewport(restoreWorkflowViewport(null));
        o.restoreBoards([createMainAnalysisBoard()], MAIN_ANALYSIS_BOARD_ID);
        o.setBoardOpen(false);
        o.setCurrentRun(null);
        o.setNodeStateRun(null);
        o.setWorkflowLastRunId(null);
        o.setLastRunSignature('');
    }, [o.restoreBoards, o.restoreWorkflowCanvasViewport, o.setBoardOpen, o.setCurrentRun, o.setDatasetId, o.setEdges, o.setLastRunSignature, o.setNodeStateRun, o.setNodes, o.setWorkflowLastRunId, persistence.resetMetadata, versions.initialize]);
    return { loadRecord, resetDocument };
}
