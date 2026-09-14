import { useCallback } from 'react';
import type { RegistryNode } from '../../../../../shared/types';
import { MAIN_ANALYSIS_BOARD_ID, normalizeEdgeHandles, normalizeFlowNodes, restoreAnalysisBoardTabs, restoreWorkflowViewport, type FlowGraph } from '../../../../_model/graph';
import type { UseWorkflowDocumentOptions } from './types';
export function useDocumentGraph(o: UseWorkflowDocumentOptions) {
    return useCallback((graph: FlowGraph, registry: RegistryNode[], aliases: Record<string, string>) => {
        const nodes = normalizeFlowNodes(graph.nodes || [], registry, aliases);
        o.setNodes(nodes);
        o.setEdges(normalizeEdgeHandles(nodes, graph.edges || []).map((edge) => ({ ...edge, animated: true })));
        o.setDatasetId(graph.meta?.datasetId ?? null);
        o.setTargetColumn(graph.meta?.targetColumn || 'target');
        o.setTaskType(graph.meta?.taskType || 'auto');
        o.restoreWorkflowCanvasViewport(restoreWorkflowViewport(graph.meta?.workflowViewport));
        o.restoreBoards(restoreAnalysisBoardTabs(graph.meta?.analysisBoards, graph.meta?.analysisBoard), String(graph.meta?.activeAnalysisBoardId || MAIN_ANALYSIS_BOARD_ID));
        o.setBoardOpen(false);
        o.clearSelection();
    }, [o.clearSelection, o.restoreBoards, o.restoreWorkflowCanvasViewport, o.setBoardOpen, o.setDatasetId, o.setEdges, o.setNodes, o.setTargetColumn, o.setTaskType]);
}
