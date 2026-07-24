import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { Edge, Node } from '@xyflow/react';
import type {
  Dataset,
  NodeCatalogResponse,
  RegistryNode,
  Run,
  RunSummary,
  Workflow,
  WorkflowComponent,
  WorkflowVersion,
  WorkflowVersionSummary,
} from '../../../../shared/_types';
import { ApiError } from '../../../../shared/_service/httpClient';
import type { AnalysisBoardTab } from '../../../_model/board';
import {
  createMainAnalysisBoard,
  defaultGraph,
  MAIN_ANALYSIS_BOARD_ID,
  normalizeEdgeHandles,
  normalizeFlowNodes,
  restoreAnalysisBoardTabs,
  type FlowGraph,
} from '../../../_model/graph';
import { workspaceApi } from '../../../_service/workspaceApi';
import { useWorkflowPersistence } from './useWorkflowPersistence';
import { useWorkflowVersions } from './useWorkflowVersions';

type UseWorkflowDocumentOptions = {
  projectId: number;
  initialWorkflowId: number | null;
  catalog: NodeCatalogResponse;
  setCatalog: Dispatch<SetStateAction<NodeCatalogResponse>>;
  nodes: Node[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  edges: Edge[];
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  clearSelection: () => void;
  datasetId: number | null;
  setDatasetId: Dispatch<SetStateAction<number | null>>;
  refreshDatasets: () => Promise<Dataset[]>;
  targetColumn: string;
  setTargetColumn: Dispatch<SetStateAction<string>>;
  taskType: string;
  setTaskType: Dispatch<SetStateAction<string>>;
  serializedBoards: AnalysisBoardTab[];
  analysisBoardSignature: unknown;
  activeBoardId: string;
  restoreBoards: (boards: AnalysisBoardTab[], activeBoardId: string) => void;
  setBoardOpen: (open: boolean) => void;
  workflowLastRunId: number | null;
  setWorkflowLastRunId: Dispatch<SetStateAction<number | null>>;
  setCurrentRun: Dispatch<SetStateAction<Run | null>>;
  setRunHistory: Dispatch<SetStateAction<RunSummary[]>>;
  setLastRunSignature: Dispatch<SetStateAction<string>>;
  setComponentItems: Dispatch<SetStateAction<WorkflowComponent[]>>;
  autosavePaused: boolean;
  versionPreview: WorkflowVersion | null;
  setVersionPreview: Dispatch<SetStateAction<WorkflowVersion | null>>;
  setMessage: (message: string) => void;
};

export function useWorkflowDocument(options: UseWorkflowDocumentOptions) {
  const {
    projectId,
    initialWorkflowId,
    catalog,
    setCatalog,
    nodes,
    setNodes,
    edges,
    setEdges,
    clearSelection,
    datasetId,
    setDatasetId,
    refreshDatasets,
    targetColumn,
    setTargetColumn,
    taskType,
    setTaskType,
    serializedBoards,
    analysisBoardSignature,
    activeBoardId,
    restoreBoards,
    setBoardOpen,
    workflowLastRunId,
    setWorkflowLastRunId,
    setCurrentRun,
    setRunHistory,
    setLastRunSignature,
    setComponentItems,
    autosavePaused,
    versionPreview,
    setVersionPreview,
    setMessage,
  } = options;
  const [, setWorkflows] = useState<Workflow[]>([]);

  const refreshWorkflows = useCallback(async () => {
    const items = await workspaceApi.workflows(projectId);
    setWorkflows(items);
    return items;
  }, [projectId]);

  const applyGraph = useCallback((
    graph: FlowGraph,
    registry: RegistryNode[],
    aliases: Record<string, string>,
  ) => {
    const normalizedNodes = normalizeFlowNodes(graph.nodes || [], registry, aliases);
    setNodes(normalizedNodes);
    setEdges(
      normalizeEdgeHandles(normalizedNodes, graph.edges || [])
        .map((edge) => ({ ...edge, animated: true })),
    );
    setDatasetId(graph.meta?.datasetId ?? null);
    setTargetColumn(graph.meta?.targetColumn || 'target');
    setTaskType(graph.meta?.taskType || 'auto');
    const boards = restoreAnalysisBoardTabs(
      graph.meta?.analysisBoards,
      graph.meta?.analysisBoard,
    );
    restoreBoards(
      boards,
      String(graph.meta?.activeAnalysisBoardId || MAIN_ANALYSIS_BOARD_ID),
    );
    setBoardOpen(false);
    clearSelection();
  }, [clearSelection, restoreBoards, setBoardOpen, setDatasetId, setEdges, setNodes, setTargetColumn, setTaskType]);

  const persistence = useWorkflowPersistence({
    projectId,
    nodes,
    edges,
    datasetId,
    targetColumn,
    taskType,
    serializedBoards,
    analysisBoardSignature,
    activeBoardId,
    workflowLastRunId,
    versionPreview,
    paused: autosavePaused,
    refreshWorkflows,
    setMessage,
  });
  const versions = useWorkflowVersions({
    catalog,
    persistence,
    workflowLastRunId,
    setWorkflowLastRunId,
    setCurrentRun,
    setLastRunSignature,
    versionPreview,
    setVersionPreview,
    applyGraph,
    refreshWorkflows,
    setMessage,
  });
  const {
    adoptWorkflow,
    resetMetadata,
    supersedeSession,
    persistSnapshot,
    autosaveSnapshot,
    autosaveSignature,
  } = persistence;
  const initializeVersions = versions.initialize;

  const loadRecord = useCallback((
    workflow: Workflow,
    workflowVersions: WorkflowVersionSummary[],
    lastRun: Run | null,
    registry: RegistryNode[],
    aliases: Record<string, string>,
  ) => {
    adoptWorkflow(workflow);
    initializeVersions(workflowVersions);
    applyGraph(workflow.graph as unknown as FlowGraph, registry, aliases);
    setCurrentRun(lastRun);
    setWorkflowLastRunId(workflow.last_run_id ?? null);
    setLastRunSignature('');
  }, [adoptWorkflow, applyGraph, initializeVersions, setCurrentRun, setLastRunSignature, setWorkflowLastRunId]);

  const resetDocument = useCallback((
    registry: RegistryNode[],
    aliases: Record<string, string>,
    fallbackDatasetId: number | null,
  ) => {
    const graph = defaultGraph(registry, aliases);
    resetMetadata();
    initializeVersions([]);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setDatasetId(fallbackDatasetId);
    restoreBoards([createMainAnalysisBoard()], MAIN_ANALYSIS_BOARD_ID);
    setBoardOpen(false);
    setCurrentRun(null);
    setWorkflowLastRunId(null);
    setLastRunSignature('');
  }, [initializeVersions, resetMetadata, restoreBoards, setBoardOpen, setCurrentRun, setDatasetId, setEdges, setLastRunSignature, setNodes, setWorkflowLastRunId]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      workspaceApi.nodeCatalog(),
      refreshDatasets(),
      workspaceApi.workflows(projectId),
      workspaceApi.listRuns(projectId),
      workspaceApi.components(projectId),
    ]).then(async ([catalogData, datasets, workflowList, runs, components]) => {
      if (!alive) return;
      setCatalog(catalogData);
      setWorkflows(workflowList);
      setRunHistory(runs);
      setComponentItems(components);
      const fallbackDatasetId = datasets[0]?.id ?? null;
      setDatasetId(fallbackDatasetId);
      if (!initialWorkflowId) {
        resetDocument(catalogData.nodes, catalogData.aliases, fallbackDatasetId);
        return;
      }
      const workflow = await workspaceApi.getWorkflow(initialWorkflowId);
      const [workflowVersions, lastRun] = await Promise.all([
        workspaceApi.workflowVersions(workflow.id)
          .catch(() => [] as WorkflowVersionSummary[]),
        workflow.last_run_id
          ? workspaceApi.getRun(workflow.last_run_id).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (!alive) return;
      loadRecord(
        workflow,
        workflowVersions,
        lastRun,
        catalogData.nodes,
        catalogData.aliases,
      );
      if ((workflow.graph as unknown as FlowGraph).meta?.datasetId == null) {
        setDatasetId(fallbackDatasetId);
      }
      setMessage('جریان بارگذاری شد');
    }).catch((error) => {
      if (alive) {
        setMessage(error instanceof Error ? error.message : 'بارگذاری پروژه ناموفق بود');
      }
    });
    return () => {
      alive = false;
    };
  }, [initialWorkflowId, loadRecord, projectId, refreshDatasets, resetDocument, setCatalog, setComponentItems, setDatasetId, setMessage, setRunHistory]);

  const loadWorkflow = useCallback(async (idValue: string) => {
    const id = Number(idValue) || null;
    if (!id) return;
    try {
      if (!versionPreview && autosaveSnapshot.name) {
        await persistSnapshot(autosaveSnapshot, autosaveSignature).catch((error) => {
          if (error instanceof ApiError && error.code === 'WORKFLOW_REVISION_CONFLICT') {
            throw error;
          }
        });
      }
      supersedeSession();
      const workflow = await workspaceApi.getWorkflow(id);
      const [workflowVersions, lastRun] = await Promise.all([
        workspaceApi.workflowVersions(id),
        workflow.last_run_id
          ? workspaceApi.getRun(workflow.last_run_id).catch(() => null)
          : Promise.resolve(null),
      ]);
      loadRecord(workflow, workflowVersions, lastRun, catalog.nodes, catalog.aliases);
      setMessage('جریان بارگذاری شد');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'بارگذاری ناموفق بود');
    }
  }, [autosaveSignature, autosaveSnapshot, catalog.aliases, catalog.nodes, loadRecord, persistSnapshot, setMessage, supersedeSession, versionPreview]);

  return {
    currentWorkflowId: persistence.currentWorkflowId,
    workflowName: persistence.workflowName,
    setWorkflowName: persistence.setWorkflowName,
    workflowVersions: versions.items,
    selectedVersionId: versions.selectedId,
    autosaveState: persistence.autosaveState,
    autosaveUpdatedAt: persistence.autosaveUpdatedAt,
    autosaveLabel: persistence.autosaveLabel,
    versionBusy: versions.busy,
    versionDialogOpen: versions.dialogOpen,
    setVersionDialogOpen: versions.setDialogOpen,
    currentGraph: persistence.currentGraph,
    currentOutputSignature: persistence.currentOutputSignature,
    autosaveSnapshot,
    autosaveSignature,
    persistSnapshot,
    refreshWorkflows,
    refreshWorkflowVersions: versions.refresh,
    loadWorkflow,
    saveVersion: versions.save,
    viewVersion: versions.view,
    returnToCurrentVersion: versions.returnToCurrent,
    restoreVersion: versions.restore,
    deleteVersion: versions.remove,
    exportCurrent: persistence.exportCurrent,
  };
}
