import { useCallback } from 'react';
import { nodesApi } from '../../../../features/custom-nodes/api/nodesApi';
import type { Output } from '../../../../features/results/components/ResultsPanel';
import { useAnalysisBoards } from '../_hooks/useAnalysisBoards';
import { useWorkflowComponents } from '../_features/components/_hooks/useWorkflowComponents';
import { useWorkflowDocument } from '../_hooks/useWorkflowDocument';
import type { WorkflowPageProps } from './types';
import type { WorkflowEditorBase } from './useWorkflowEditorBase';
export function useWorkflowEditorDocument({ project, user, initialWorkflowId }: WorkflowPageProps, base: WorkflowEditorBase, outputs: Output[]) {
    const { graph, runs, shell } = base;
    const boards = useAnalysisBoards({ outputs, currentRunId: runs.displayRun?.id ?? null, nodes: graph.documentNodes, selectedNodeId: graph.selectedId,
        readOnly: base.readOnly, boardOpen: shell.analysisBoardOpen, setBoardOpen: shell.setAnalysisBoardOpen, setMessage: base.setMessage });
    const refreshRegistry = useCallback(async () => { base.setCatalog(await nodesApi.catalog(base.projectId)); }, [base.projectId, base.setCatalog]);
    const components = useWorkflowComponents({ projectId: base.projectId, user, nodes: graph.documentNodes, setNodes: graph.setNodes, edges: graph.edges, setEdges: graph.setEdges,
        selectedIds: graph.selectedIds, setSelectedId: graph.setSelectedId, setSelectedIds: graph.setSelectedIds, setSelectedEdgeId: graph.setSelectedEdgeId,
        setSelectedEdgeIds: graph.setSelectedEdgeIds, setModalNodeId: graph.setModalNodeId, registry: base.catalog.nodes, aliases: base.catalog.aliases,
        readOnly: base.readOnly, fitView: base.flow.fitView, setBoardOpen: shell.setAnalysisBoardOpen, setMessage: base.setMessage, refreshRegistry });
    const document = useWorkflowDocument({ projectId: base.projectId, initialWorkflowId, catalog: base.catalog, setCatalog: base.setCatalog, nodes: graph.documentNodes,
        setNodes: graph.setNodes, edges: graph.edges, setEdges: graph.setEdges, clearSelection: graph.clearSelection, datasetId: base.datasets.datasetId,
        setDatasetId: base.datasets.setDatasetId, refreshDatasets: base.datasets.refreshDatasets, targetColumn: base.targetColumn, setTargetColumn: base.setTargetColumn,
        taskType: base.taskType, setTaskType: base.setTaskType, restoreWorkflowCanvasViewport: base.workflowCanvas.restore, serializedBoards: boards.serializedBoards,
        analysisBoardSignature: boards.persistenceSignature, activeBoardId: boards.activeBoardId, restoreBoards: boards.restoreBoards, setBoardOpen: shell.setAnalysisBoardOpen,
        workflowLastRunId: runs.workflowLastRunId, setWorkflowLastRunId: runs.setWorkflowLastRunId, setCurrentRun: runs.setCurrentRun, setNodeStateRun: runs.setNodeStateRun,
        setRunHistory: runs.setRunHistory, setLastRunSignature: runs.setLastRunSignature, autosavePaused: !project.can_edit || Boolean(components.editor),
        versionPreview: base.versionPreview, setVersionPreview: base.setVersionPreview, setMessage: base.setMessage });
    return { boards, components, document, refreshRegistry };
}
export type WorkflowEditorDocument = ReturnType<typeof useWorkflowEditorDocument>;
