import { useMemo } from 'react';
import type { Output } from '../../../../features/results/components/ResultsPanel';
import { normalizeEdgeHandles, normalizeFlowNodes, workflowOutputSignature, type FlowGraph } from '../../../_model/graph';
import { useWorkflowLayout } from '../../../_hooks/useWorkflowLayout';
import { useBoardDialogs } from '../_features/boards/_hooks/useBoardDialogs';
import { useCustomNodes } from '../_hooks/useCustomNodes';
import { useInteractiveTableController } from '../_hooks/useInteractiveTableController';
import { useNodeColumnContext } from '../_hooks/useNodeColumnContext';
import { useWorkflowCanvasActions } from '../_hooks/useWorkflowCanvasActions';
import { useWorkflowExecution } from '../_hooks/useWorkflowExecution';
import type { WorkflowPageProps } from './types';
import type { WorkflowEditorBase } from './useWorkflowEditorBase';
import type { WorkflowEditorDocument } from './useWorkflowEditorDocument';
export function useWorkflowEditorRuntime({ initialWorkflowId }: WorkflowPageProps, base: WorkflowEditorBase, data: WorkflowEditorDocument, outputs: Output[]) {
    const { graph, runs, shell } = base;
    const outputRun = runs.nodeStateRun || runs.displayRun;
    const persistedOutputSignature = useMemo(() => {
        if (!outputRun) return '';
        const saved = outputRun.workflow_graph as unknown as FlowGraph;
        if (!Array.isArray(saved?.nodes) || !Array.isArray(saved?.edges)) return '';
        const nodes = normalizeFlowNodes(saved.nodes, base.catalog.nodes, base.catalog.aliases);
        return workflowOutputSignature(nodes, normalizeEdgeHandles(nodes, saved.edges), outputRun.dataset_id,
            outputRun.target_column || 'target', outputRun.task_type || 'auto');
    }, [outputRun, base.catalog.nodes, base.catalog.aliases]);
    const customNodes = useCustomNodes({ refreshRegistry: data.refreshRegistry, setMessage: base.setMessage });
    const columns = useNodeColumnContext({ nodes: graph.documentNodes, edges: graph.edges, nodesById: graph.nodesById, datasets: base.datasets.datasets,
        datasetId: base.datasets.datasetId, aliases: base.catalog.aliases, selectedNodeId: graph.selectedId, modalNodeId: graph.modalNodeId, outputs: persistedOutputSignature === data.document.currentOutputSignature ? outputs : [] });
    const boardDialogs = useBoardDialogs({ activeBoard: data.boards.activeBoard, readOnly: base.readOnly, renameBoard: data.boards.renameBoard, removeBoard: data.boards.removeBoard });
    const canvas = useWorkflowCanvasActions({ nodes: graph.nodes, setNodes: graph.setNodes, edges: graph.edges, setEdges: graph.setEdges, registry: base.catalog.nodes,
        catalog: base.catalog, readOnly: base.readOnly, currentRun: runs.displayRun, resultsWidth: base.resultsWidth, paletteCollapsed: shell.paletteCollapsed,
        resultsCollapsed: shell.resultsCollapsed, screenToFlowPosition: base.flow.screenToFlowPosition, fitView: base.flow.fitView, setMessage: base.setMessage,
        setResultsCollapsed: shell.setResultsCollapsed, setSelectedId: graph.setSelectedId, setSelectedIds: graph.setSelectedIds, setSelectedEdgeId: graph.setSelectedEdgeId,
        setSelectedEdgeIds: graph.setSelectedEdgeIds, setModalNodeId: graph.setModalNodeId, selectNode: graph.selectNode, enterComponentNode: data.components.enterNode,
        renameNodeSources: data.boards.renameNodeSources });
    const interactiveTable = useInteractiveTableController({ scope: `workflow:${data.document.currentWorkflowId ?? initialWorkflowId ?? 'draft'}`, nodes: graph.documentNodes, outputs, updateNodeParams: canvas.updateNodeParams });
    const execution = useWorkflowExecution({ nodes: graph.documentNodes, edges: graph.edges, selectedId: graph.selectedId, setSelectedId: graph.setSelectedId,
        setSelectedIds: graph.setSelectedIds, setSelectedEdgeId: graph.setSelectedEdgeId, setSelectedEdgeIds: graph.setSelectedEdgeIds, versionPreviewActive: base.readOnly,
        componentEditorActive: Boolean(data.components.editor), workflowName: data.document.workflowName, datasetId: base.datasets.datasetId, projectId: base.projectId,
        targetColumn: base.targetColumn, taskType: base.taskType, autosaveSnapshot: data.document.autosaveSnapshot, autosaveSignature: data.document.autosaveSignature,
        currentOutputSignature: data.document.currentOutputSignature, persistSnapshot: data.document.persistSnapshot, setBusy: runs.setBusy, setLastRunSignature: runs.setLastRunSignature,
        recordRun: runs.recordRun, retryRunWithSignature: runs.retryRun, setMessage: base.setMessage });
    const layout = useWorkflowLayout(shell.paletteCollapsed, shell.resultsCollapsed, base.resultsWidth, base.setResultsWidth);
    return { customNodes, columns, boardDialogs, canvas, interactiveTable, execution, layout };
}
export type WorkflowEditorRuntime = ReturnType<typeof useWorkflowEditorRuntime>;
