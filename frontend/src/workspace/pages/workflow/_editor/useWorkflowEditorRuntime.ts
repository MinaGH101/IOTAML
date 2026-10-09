import { useCallback, useMemo } from 'react';
import type { Output } from '../../../../features/results/components/ResultsPanel';
import { createAutosaveSignature, createAutosaveSnapshot } from '../../../_model/workflowPersistence';
import { normalizeEdgeHandles, workflowOutputSignature, type FlowGraph } from '../../../_model/graph';
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
    const customNodes = useCustomNodes({ refreshRegistry: data.refreshRegistry, setMessage: base.setMessage });
    const columns = useNodeColumnContext({ nodes: graph.documentNodes, edges: graph.edges, nodesById: graph.nodesById, datasets: base.datasets.datasets,
        datasetId: base.datasets.datasetId, aliases: base.catalog.aliases, selectedNodeId: graph.selectedId, modalNodeId: graph.modalNodeId, outputs });
    const boardDialogs = useBoardDialogs({ activeBoard: data.boards.activeBoard, readOnly: base.readOnly, renameBoard: data.boards.renameBoard, removeBoard: data.boards.removeBoard });
    const canvas = useWorkflowCanvasActions({ nodes: graph.nodes, setNodes: graph.setNodes, edges: graph.edges, setEdges: graph.setEdges, registry: base.catalog.nodes,
        catalog: base.catalog, datasets: base.datasets.datasets, datasetId: base.datasets.datasetId, readOnly: base.readOnly, canManageLocks: base.canManageLocks, currentRun: runs.displayRun, resultsWidth: base.resultsWidth, paletteCollapsed: shell.paletteCollapsed,
        resultsCollapsed: shell.resultsCollapsed, screenToFlowPosition: base.flow.screenToFlowPosition, fitView: base.flow.fitView, setMessage: base.setMessage,
        setResultsCollapsed: shell.setResultsCollapsed, setSelectedId: graph.setSelectedId, setSelectedIds: graph.setSelectedIds, setSelectedEdgeId: graph.setSelectedEdgeId,
        setSelectedEdgeIds: graph.setSelectedEdgeIds, setModalNodeId: graph.setModalNodeId, selectNode: graph.selectNode, enterComponentNode: data.components.enterNode,
        renameNodeSources: data.boards.renameNodeSources });
    const interactiveTable = useInteractiveTableController({ scope: `workflow:${data.document.currentWorkflowId ?? initialWorkflowId ?? 'draft'}`, nodes: graph.documentNodes, outputs, updateNodeParams: canvas.updateNodeParams });
    const getExecutionSnapshot = useCallback(() => {
        const latest = graph.getDocumentGraph();
        const edges = normalizeEdgeHandles(latest.nodes, latest.edges);
        const currentGraph: FlowGraph = {
            nodes: latest.nodes,
            edges,
            meta: {
                datasetId: base.datasets.datasetId,
                targetColumn: base.targetColumn,
                taskType: base.taskType,
                analysisBoards: data.boards.serializedBoards,
                activeAnalysisBoardId: data.boards.activeBoardId,
            },
        };
        return {
            nodes: latest.nodes,
            edges,
            autosaveSnapshot: createAutosaveSnapshot({ name: data.document.workflowName, graph: currentGraph as unknown as Record<string, unknown>, projectId: base.projectId }),
            autosaveSignature: createAutosaveSignature({ name: data.document.workflowName, projectId: base.projectId, nodes: latest.nodes, edges, datasetId: base.datasets.datasetId, targetColumn: base.targetColumn, taskType: base.taskType, activeBoardId: data.boards.activeBoardId, analysisBoards: data.boards.persistenceSignature }),
            currentOutputSignature: workflowOutputSignature(latest.nodes, edges, base.datasets.datasetId, base.targetColumn, base.taskType),
        };
    }, [base.datasets.datasetId, base.projectId, base.targetColumn, base.taskType, data.boards.activeBoardId, data.boards.persistenceSignature, data.boards.serializedBoards, data.document.workflowName, graph]);
    const execution = useWorkflowExecution({ nodes: graph.documentNodes, edges: graph.edges, selectedId: graph.selectedId, setSelectedId: graph.setSelectedId,
        setSelectedIds: graph.setSelectedIds, setSelectedEdgeId: graph.setSelectedEdgeId, setSelectedEdgeIds: graph.setSelectedEdgeIds, versionPreviewActive: base.readOnly,
        componentEditorActive: Boolean(data.components.editor), workflowName: data.document.workflowName, datasetId: base.datasets.datasetId, projectId: base.projectId,
        targetColumn: base.targetColumn, taskType: base.taskType, getExecutionSnapshot, autosaveSnapshot: data.document.autosaveSnapshot, autosaveSignature: data.document.autosaveSignature,
        currentOutputSignature: data.document.currentOutputSignature, persistSnapshot: data.document.persistSnapshot, setBusy: runs.setBusy, setLastRunSignature: runs.setLastRunSignature,
        recordRun: runs.recordRun, retryRunWithSignature: runs.retryRun, setMessage: base.setMessage });
    const layout = useWorkflowLayout(shell.paletteCollapsed, shell.resultsCollapsed, base.resultsWidth, base.setResultsWidth);
    return { customNodes, columns, boardDialogs, canvas, interactiveTable, execution, layout };
}
export type WorkflowEditorRuntime = ReturnType<typeof useWorkflowEditorRuntime>;
