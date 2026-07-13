import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange
} from '@xyflow/react';
import { ArrowRight, Download, LayoutDashboard, LayoutGrid, LogOut, MoreHorizontal, Play, PlusCircle, RefreshCw, Save, Square, Trash2, UserCircle } from 'lucide-react';
import { api } from '../api';
import { CustomSelect } from '../components/CustomSelect';
import { CustomNodeBuilder } from '../components/CustomNodeBuilder';
import { AnalysisBoard, type AnalysisBoardItem, type AnalysisBoardTab } from '../components/AnalysisBoard';
import { NodeModal } from '../components/NodeModal';
import { ThemeToggle } from '../components/ThemeToggle';
import { normalizeOutputs, type Output } from '../components/ResultsPanel';
import { NodeMenu } from './NodeMenu';
import { WorkflowNodesList } from './WorkflowNodesList';
import { RightPanel } from './RightPanel';
import { MlNode } from '../nodes/MlNode';
import type { CustomNodeDefinition, CustomNodePayload, Dataset, NodeCatalogResponse, Project, RegistryNode, Run, RunProgressSnapshot, RunSummary, UserProfile, Workflow } from '../types';
import { sameStringArray } from '../utils/appShared';
import { exportWorkflowJson } from '../utils/workflowJson';
import { compatiblePorts, portTypeFor } from '../features/workflow/catalog';
import {
  boardOutputTitle,
  connectedGraph,
  defaultGraph,
  inputColumnsForNode,
  isTextInput,
  makeNode,
  normalizeFlowNodes,
  createMainAnalysisBoard,
  MAIN_ANALYSIS_BOARD_ID,
  restoreAnalysisBoardTabs,
  serializeAnalysisBoardTabs,
  workflowOutputSignature,
  type FlowGraph,
} from '../features/workflow/graph';

const nodeTypes = { mlNode: MlNode };
const multiSelectionKeys = ['Meta', 'Control', 'Shift'];
const terminalRunStatuses = new Set(['succeeded', 'failed', 'cancelled', 'timed_out']);

type RunReference = Pick<Run, 'id' | 'status'> | RunSummary;

function runToSummary(run: Run): RunSummary {
  return {
    id: run.id,
    status: run.status,
    workflow_name: run.workflow_name,
    project_id: run.project_id,
    attempts: run.attempts,
    max_attempts: run.max_attempts,
    cancel_requested: run.cancel_requested,
    progress: run.progress,
    error: run.error,
    created_at: run.created_at,
    queued_at: run.queued_at,
    started_at: run.started_at,
    finished_at: run.finished_at,
  };
}

function upsertRunSummary(items: RunSummary[], run: Run) {
  return [runToSummary(run), ...items.filter((item) => item.id !== run.id)].slice(0, 50);
}

function mergeRunProgress(run: Run, snapshot: RunProgressSnapshot): Run {
  const currentProgress = run.progress || {};
  const nextProgress = snapshot.progress || {};
  const progressUnchanged = currentProgress.updated_at === nextProgress.updated_at
    && currentProgress.percent === nextProgress.percent
    && currentProgress.nodes_finished === nextProgress.nodes_finished
    && currentProgress.nodes_total === nextProgress.nodes_total
    && currentProgress.current_node_id === nextProgress.current_node_id;
  const nodesUnchanged = progressUnchanged;

  if (
    run.status === snapshot.status
    && run.attempts === snapshot.attempts
    && run.max_attempts === snapshot.max_attempts
    && run.cancel_requested === snapshot.cancel_requested
    && run.heartbeat_at === snapshot.heartbeat_at
    && run.started_at === snapshot.started_at
    && run.finished_at === snapshot.finished_at
    && run.error === snapshot.error
    && progressUnchanged
    && nodesUnchanged
  ) return run;

  return {
    ...run,
    status: snapshot.status,
    attempts: snapshot.attempts,
    max_attempts: snapshot.max_attempts,
    cancel_requested: snapshot.cancel_requested,
    heartbeat_at: snapshot.heartbeat_at,
    started_at: snapshot.started_at,
    finished_at: snapshot.finished_at,
    error: snapshot.error,
    progress: snapshot.progress,
    node_statuses: snapshot.node_statuses,
  };
}

function BoardIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16" />
      <path d="M15 4v16" />
      <rect x="5.5" y="7" width="2.8" height="3.2" rx=".7" fill="currentColor" stroke="none" />
      <rect x="10.6" y="11" width="2.8" height="3.2" rx=".7" fill="currentColor" stroke="none" />
      <rect x="16" y="8" width="2.8" height="3.2" rx=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}
type PinnedNodeData = { enabled?: boolean; sample?: string };
type WorkflowPageProps = {
  project: Project;
  user: UserProfile;
  initialWorkflowId: number | null;
  onBack: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onProjects: () => void;
};
function WorkflowEditor({ project, user, initialWorkflowId, onBack, onProfile, onLogout, onProjects }: WorkflowPageProps) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const projectId = project.id;
  const [catalog, setCatalog] = useState<NodeCatalogResponse>({ version: 0, nodes: [], aliases: {}, categories: [], compatiblePorts: {} });
  const registry = catalog.nodes;
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<number | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [modalNodeId, setModalNodeId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState('جریان IOTA ML');
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [targetColumn, setTargetColumn] = useState('target');
  const [taskType, setTaskType] = useState('auto');
  const [currentRun, setCurrentRun] = useState<Run | null>(null);
  const [runHistory, setRunHistory] = useState<RunSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [resultsWidth, setResultsWidth] = useState(380);
  const [resultsCollapsed, setResultsCollapsed] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [nodeResultsCollapsed, setNodeResultsCollapsed] = useState(false);
  const [quickSettingsCollapsed, setQuickSettingsCollapsed] = useState(false);
  const [analysisBoardOpen, setAnalysisBoardOpen] = useState(false);
  const [analysisBoards, setAnalysisBoards] = useState<AnalysisBoardTab[]>(() => [createMainAnalysisBoard()]);
  const [activeBoardId, setActiveBoardId] = useState(MAIN_ANALYSIS_BOARD_ID);
  const [boardTargetId, setBoardTargetId] = useState(MAIN_ANALYSIS_BOARD_ID);
  const [lastRunSignature, setLastRunSignature] = useState('');
  const [customBuilderDefinition, setCustomBuilderDefinition] = useState<CustomNodeDefinition | null>(null);
  const [customBuilderOpen, setCustomBuilderOpen] = useState(false);
  const [customBuilderBusy, setCustomBuilderBusy] = useState(false);

  const refreshRegistry = useCallback(async () => setCatalog(await api.nodeCatalog()), []);
  const refreshWorkflows = useCallback(async () => setWorkflows(await api.workflows(projectId)), [projectId]);
  const refreshRunHistory = useCallback(async () => setRunHistory(await api.listRuns(projectId)), [projectId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
        event.preventDefault();
        setAnalysisBoardOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.nodeCatalog(), api.datasets(projectId), api.workflows(projectId), api.listRuns(projectId)])
      .then(async ([catalogData, datasetList, workflowList, runList]) => {
        const nodeRegistry = catalogData.nodes;
        if (!alive) return;
        setCatalog(catalogData);
        setDatasets(datasetList);
        setWorkflows(workflowList);
        setRunHistory(runList);
        setDatasetId(datasetList[0]?.id ?? null);

        if (initialWorkflowId) {
          const workflow = await api.getWorkflow(initialWorkflowId);
          if (!alive) return;
          const graph = workflow.graph as unknown as FlowGraph;
          setCurrentWorkflowId(workflow.id);
          setWorkflowName(workflow.name);
          setNodes(normalizeFlowNodes(graph.nodes || [], nodeRegistry, catalogData.aliases));
          setEdges((graph.edges || []).map((edge) => ({ ...edge, animated: true })));
          setDatasetId(graph.meta?.datasetId ?? datasetList[0]?.id ?? null);
          setTargetColumn(graph.meta?.targetColumn || 'target');
          setTaskType(graph.meta?.taskType || 'auto');
          const restoredBoards = restoreAnalysisBoardTabs(graph.meta?.analysisBoards, graph.meta?.analysisBoard);
          const restoredActiveId = restoredBoards.some((tab) => tab.id === graph.meta?.activeAnalysisBoardId) ? String(graph.meta?.activeAnalysisBoardId) : MAIN_ANALYSIS_BOARD_ID;
          setAnalysisBoards(restoredBoards);
          setActiveBoardId(restoredActiveId);
          setBoardTargetId(restoredActiveId);
          setAnalysisBoardOpen(false);
          setLastRunSignature('');
          setMessage('جریان بارگذاری شد');
          return;
        }

        const graph = defaultGraph(nodeRegistry, catalogData.aliases);
        setNodes(graph.nodes); setEdges(graph.edges);
        setAnalysisBoards([createMainAnalysisBoard()]);
        setActiveBoardId(MAIN_ANALYSIS_BOARD_ID);
        setBoardTargetId(MAIN_ANALYSIS_BOARD_ID);
        setAnalysisBoardOpen(false);
        setLastRunSignature('');
        setCurrentWorkflowId(null);
        setWorkflowName('جریان IOTA ML');
      })
      .catch((error) => setMessage(error.message));
    return () => { alive = false; };
  }, [projectId, initialWorkflowId]);

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedId) || null, [nodes, selectedId]);
  const selectedEdge = useMemo(() => edges.find((edge) => edge.id === selectedEdgeId) || null, [edges, selectedEdgeId]);
  const selectedFlow = useMemo(() => connectedGraph(nodes, edges, selectedId), [nodes, edges, selectedId]);
  const workflowOptions = useMemo(() => [{ value: '', label: 'جریان جدید/ذخیره‌نشده' }, ...workflows.map((wf) => ({ value: String(wf.id), label: wf.name }))], [workflows]);
  const modalNode = useMemo(() => nodes.find((node) => node.id === modalNodeId) || null, [nodes, modalNodeId]);

  const availableColumns = useMemo(() => {
    const editorNodeId = modalNodeId || selectedId;
    return inputColumnsForNode(editorNodeId, nodes, edges, datasets, datasetId, catalog.aliases);
  }, [nodes, edges, selectedId, modalNodeId, datasets, datasetId, catalog.aliases]);

  const allRunOutputs = useMemo(() => normalizeOutputs(currentRun, null), [currentRun]);
  const currentOutputSignature = useMemo(() => workflowOutputSignature(nodes, edges, datasetId, targetColumn, taskType), [nodes, edges, datasetId, targetColumn, taskType]);
  const workflowDirtyForBoard = Boolean(currentRun && lastRunSignature && currentOutputSignature !== lastRunSignature);
  const activeBoard = useMemo(() => analysisBoards.find((tab) => tab.id === activeBoardId) || analysisBoards[0], [analysisBoards, activeBoardId]);
  const analysisBoardItems = activeBoard?.items || [];

  useEffect(() => {
    if (!analysisBoards.some((tab) => tab.id === activeBoardId)) setActiveBoardId(MAIN_ANALYSIS_BOARD_ID);
    if (!analysisBoards.some((tab) => tab.id === boardTargetId)) setBoardTargetId(MAIN_ANALYSIS_BOARD_ID);
  }, [analysisBoards, activeBoardId, boardTargetId]);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((items) => applyNodeChanges(changes, items)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((items) => applyEdgeChanges(changes, items)), []);
  const onConnect = useCallback((connection: Connection) => {
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);
    const sourceType = portTypeFor(sourceNode, registry, catalog.aliases, connection.sourceHandle, 'source');
    const targetType = portTypeFor(targetNode, registry, catalog.aliases, connection.targetHandle, 'target');
    if (!compatiblePorts(sourceType, targetType, catalog.compatiblePorts)) {
      setMessage(`اتصال نامعتبر است: ${sourceType} → ${targetType}`);
      return;
    }
    setEdges((items) => addEdge({ ...connection, animated: true }, items));
  }, [nodes, registry, catalog.aliases, catalog.compatiblePorts]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) => {
    const nextNodeIds = selectedNodes.map((node) => node.id);
    const nextEdgeIds = selectedEdges.map((edge) => edge.id);

    setSelectedIds((previous) => (sameStringArray(previous, nextNodeIds) ? previous : nextNodeIds));
    setSelectedEdgeIds((previous) => (sameStringArray(previous, nextEdgeIds) ? previous : nextEdgeIds));

    if (nextNodeIds.length > 0) {
      const nextSelectedId = nextNodeIds[0];
      setSelectedId((previous) => (previous === nextSelectedId ? previous : nextSelectedId));
      setSelectedEdgeId((previous) => (previous === null ? previous : null));
      return;
    }

    if (nextEdgeIds.length > 0) {
      const nextSelectedEdgeId = nextEdgeIds[0];
      setSelectedEdgeId((previous) => (previous === nextSelectedEdgeId ? previous : nextSelectedEdgeId));
      setSelectedId((previous) => (previous === null ? previous : null));
      return;
    }

    setSelectedId((previous) => (previous === null ? previous : null));
    setSelectedEdgeId((previous) => (previous === null ? previous : null));
  }, []);

  const onNodeClick = useCallback((_: ReactMouseEvent, node: Node) => {
    setSelectedId((previous) => (previous === node.id ? previous : node.id));
    setSelectedIds((previous) => (sameStringArray(previous, [node.id]) ? previous : [node.id]));
    setSelectedEdgeId((previous) => (previous === null ? previous : null));
    setSelectedEdgeIds((previous) => (previous.length === 0 ? previous : []));
  }, []);

  const onNodeDoubleClick = useCallback((_: ReactMouseEvent, node: Node) => {
    setSelectedId((previous) => (previous === node.id ? previous : node.id));
    setSelectedIds((previous) => (sameStringArray(previous, [node.id]) ? previous : [node.id]));
    setModalNodeId(node.id);
  }, []);

  const onEdgeClick = useCallback((_: ReactMouseEvent, edge: Edge) => {
    setSelectedEdgeId((previous) => (previous === edge.id ? previous : edge.id));
    setSelectedEdgeIds((previous) => (sameStringArray(previous, [edge.id]) ? previous : [edge.id]));
    setSelectedId((previous) => (previous === null ? previous : null));
    setSelectedIds((previous) => (previous.length === 0 ? previous : []));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedId((previous) => (previous === null ? previous : null));
    setSelectedIds((previous) => (previous.length === 0 ? previous : []));
    setSelectedEdgeId((previous) => (previous === null ? previous : null));
    setSelectedEdgeIds((previous) => (previous.length === 0 ? previous : []));
  }, []);

  const deleteSelected = useCallback(() => {
    const nodeIds = selectedIds.length ? selectedIds : (selectedId ? [selectedId] : []);
    const edgeIds = selectedEdgeIds.length ? selectedEdgeIds : (selectedEdgeId ? [selectedEdgeId] : []);
    if (nodeIds.length) {
      const remove = new Set(nodeIds);
      setNodes((items) => items.filter((node) => !remove.has(node.id)));
      setEdges((items) => items.filter((edge) => !remove.has(edge.source) && !remove.has(edge.target)));
      setSelectedId(null); setSelectedIds([]); setSelectedEdgeId(null); setSelectedEdgeIds([]); setModalNodeId(null); return;
    }
    if (edgeIds.length) {
      const removeEdges = new Set(edgeIds);
      setEdges((items) => items.filter((edge) => !removeEdges.has(edge.id)));
      setSelectedEdgeId(null); setSelectedEdgeIds([]);
    }
  }, [selectedId, selectedIds, selectedEdgeId, selectedEdgeIds]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if ((event.key === 'Delete' || event.key === 'Backspace') && !isTextInput(event.target)) deleteSelected(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected]);

  const updateNodeParams = useCallback((nodeId: string, params: Record<string, unknown>) => {
    setNodes((items) => items.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, params } } : node)));
  }, []);

  const renameNode = useCallback((nodeId: string, label: string) => {
    setNodes((items) => items.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, label } } : node)));
  }, []);

  const updateNodePinned = useCallback((nodeId: string, pinned: PinnedNodeData) => {
    setNodes((items) => items.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, pinned } } : node)));
  }, []);

  const selectWorkflowNode = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
    setSelectedIds([nodeId]);
    setSelectedEdgeId(null);
    setSelectedEdgeIds([]);
    setResultsCollapsed(false);
  }, []);

  const updateBoardItems = useCallback((boardId: string, updater: (items: AnalysisBoardItem[]) => AnalysisBoardItem[]) => {
    setAnalysisBoards((tabs) => tabs.map((tab) => tab.id === boardId ? { ...tab, items: updater(tab.items) } : tab));
  }, []);

  const addOutputToBoard = useCallback((output: Output, visibleIndex: number, destinationBoardId: string) => {
    const nodeId = output.node_id ? String(output.node_id) : selectedId;
    const nodeOutputs = allRunOutputs.filter((item) => String(item.node_id || '') === String(nodeId || ''));
    const nodeOutputIndex = nodeOutputs.findIndex((item) => item === output);
    const outputIndex = nodeOutputIndex >= 0 ? nodeOutputIndex : visibleIndex;
    const nodeLabel = nodes.find((node) => node.id === nodeId)?.data?.label;

    updateBoardItems(destinationBoardId, (items) => {
      const offset = items.length % 5;
      const item: AnalysisBoardItem = {
        id: `board-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        nodeId,
        outputIndex,
        outputTitle: boardOutputTitle(output, outputIndex),
        outputKind: String(output.kind || 'json'),
        sourceLabel: nodeLabel ? String(nodeLabel) : undefined,
        x: 28 + offset * 34,
        y: 28 + offset * 34,
        w: 440,
        h: 330,
        runId: currentRun?.id ?? null,
        snapshot: output,
        createdAt: new Date().toISOString(),
      };
      return [...items, item];
    });
    setActiveBoardId(destinationBoardId);
    setBoardTargetId(destinationBoardId);
    setAnalysisBoardOpen(true);
    const destination = analysisBoards.find((tab) => tab.id === destinationBoardId)?.name || 'برد اصلی';
    setMessage(`خروجی به ${destination} اضافه شد`);
  }, [allRunOutputs, analysisBoards, currentRun?.id, nodes, selectedId, updateBoardItems]);

  const addOutputToMainBoard = useCallback((output: Output, visibleIndex: number) => {
    addOutputToBoard(output, visibleIndex, MAIN_ANALYSIS_BOARD_ID);
  }, [addOutputToBoard]);

  const addOutputFromRightPanel = useCallback((output: Output, visibleIndex: number) => {
    addOutputToBoard(output, visibleIndex, analysisBoardOpen ? boardTargetId : MAIN_ANALYSIS_BOARD_ID);
  }, [addOutputToBoard, analysisBoardOpen, boardTargetId]);

  const createAnalysisBoard = useCallback(() => {
    const id = `analysis-board-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setAnalysisBoards((tabs) => [...tabs, { id, name: `برد ${tabs.length + 1}`, items: [], createdAt: new Date().toISOString() }]);
    setActiveBoardId(id);
    setBoardTargetId(id);
  }, []);

  const renameAnalysisBoard = useCallback((id: string, name: string) => {
    const normalized = name.trim();
    if (!normalized) return;
    setAnalysisBoards((tabs) => tabs.map((tab) => tab.id === id ? { ...tab, name: normalized } : tab));
  }, []);

  const removeAnalysisBoard = useCallback((id: string) => {
    if (id === MAIN_ANALYSIS_BOARD_ID) return;
    setAnalysisBoards((tabs) => tabs.filter((tab) => tab.id !== id));
    setActiveBoardId(MAIN_ANALYSIS_BOARD_ID);
    setBoardTargetId(MAIN_ANALYSIS_BOARD_ID);
  }, []);

  const updateBoardItem = useCallback((id: string, patch: Partial<AnalysisBoardItem>) => {
    updateBoardItems(activeBoardId, (items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }, [activeBoardId, updateBoardItems]);

  const removeBoardItem = useCallback((id: string) => {
    updateBoardItems(activeBoardId, (items) => items.filter((item) => item.id !== id));
  }, [activeBoardId, updateBoardItems]);

  const duplicateBoardItem = useCallback((item: AnalysisBoardItem) => {
    updateBoardItems(activeBoardId, (items) => [...items, {
      ...item,
      id: `board-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      x: item.x + 26,
      y: item.y + 26,
      createdAt: new Date().toISOString(),
    }]);
  }, [activeBoardId, updateBoardItems]);

  const clearActiveBoard = useCallback(() => {
    updateBoardItems(activeBoardId, () => []);
  }, [activeBoardId, updateBoardItems]);

  const openCustomNodeBuilder = useCallback(() => {
    setCustomBuilderDefinition(null);
    setCustomBuilderOpen(true);
  }, []);

  const editCustomNode = useCallback(async (node: RegistryNode) => {
    if (!node.isCustom) return;
    setCustomBuilderBusy(true);
    try {
      const definition = await api.customNode(node.id);
      setCustomBuilderDefinition(definition);
      setCustomBuilderOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'بارگذاری نود سفارشی ناموفق بود');
    } finally {
      setCustomBuilderBusy(false);
    }
  }, []);

  const saveCustomNode = useCallback(async (payload: CustomNodePayload) => {
    setCustomBuilderBusy(true);
    try {
      if (customBuilderDefinition) await api.updateCustomNode(customBuilderDefinition.id, payload);
      else await api.createCustomNode(payload);
      await refreshRegistry();
      setCustomBuilderOpen(false);
      setCustomBuilderDefinition(null);
      setMessage('نود سفارشی ذخیره شد و در User Nodes قرار گرفت');
    } finally {
      setCustomBuilderBusy(false);
    }
  }, [customBuilderDefinition, refreshRegistry]);

  const deleteCustomNode = useCallback(async () => {
    if (!customBuilderDefinition) return;
    if (!window.confirm(`نود «${customBuilderDefinition.label}» حذف شود؟`)) return;
    setCustomBuilderBusy(true);
    try {
      await api.deleteCustomNode(customBuilderDefinition.id);
      await refreshRegistry();
      setCustomBuilderOpen(false);
      setCustomBuilderDefinition(null);
      setMessage('نود سفارشی حذف شد');
    } finally {
      setCustomBuilderBusy(false);
    }
  }, [customBuilderDefinition, refreshRegistry]);

  const uploadDataset = async (file: File) => {
    setMessage('در حال آپلود دیتاست...');
    try { const dataset = await api.uploadDataset(file, projectId); const next = await api.datasets(projectId); setDatasets(next); setDatasetId(dataset.id); setMessage(`دیتاست ${dataset.name} آپلود شد`); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'آپلود ناموفق بود'); }
  };

  const deleteDataset = async (id: number) => {
    setMessage('در حال حذف دیتاست...');
    try {
      await api.deleteDataset(id);
      const next = await api.datasets(projectId);
      setDatasets(next);
      if (datasetId === id) setDatasetId(next[0]?.id ?? null);
      setNodes((items) => items.map((node) => {
        const params = (node.data.params || {}) as Record<string, unknown>;
        if (String(node.data.registryId || '') === 'DI-002' && Number(params.dataset_id || 0) === id) {
          return { ...node, data: { ...node.data, params: { ...params, dataset_id: null } } };
        }
        return node;
      }));
      setMessage('دیتاست حذف شد');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'حذف دیتاست ناموفق بود'); }
  };

  const onDragOver = useCallback((event: DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    const nodeId = event.dataTransfer.getData('application/nocodeml-node');
    const registryNode = registry.find((node) => node.id === nodeId);
    if (!registryNode) return;
    const newNode = makeNode(registryNode, nodes.length, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    setNodes((items) => [...items, newNode]); setSelectedId(newNode.id); setSelectedEdgeId(null);
  }, [nodes.length, registry, screenToFlowPosition]);

  const prettyLayout = () => {
    const incoming = new Map<string, string[]>();
    const outgoing = new Map<string, string[]>();
    nodes.forEach((node) => { incoming.set(node.id, []); outgoing.set(node.id, []); });
    edges.forEach((edge) => { outgoing.get(edge.source)?.push(edge.target); incoming.get(edge.target)?.push(edge.source); });

    const roots = nodes.filter((node) => (incoming.get(node.id) || []).length === 0).map((node) => node.id);
    const depth = new Map<string, number>();
    const queue = roots.length ? [...roots] : nodes.slice(0, 1).map((node) => node.id);
    queue.forEach((id) => depth.set(id, 0));

    while (queue.length) {
      const id = queue.shift()!;
      const nextDepth = (depth.get(id) || 0) + 1;
      (outgoing.get(id) || []).forEach((child) => {
        if (!depth.has(child) || nextDepth > (depth.get(child) || 0)) {
          depth.set(child, nextDepth);
          queue.push(child);
        }
      });
    }

    nodes.forEach((node) => { if (!depth.has(node.id)) depth.set(node.id, 0); });

    const groups = new Map<number, Node[]>();
    nodes.forEach((node) => {
      const d = depth.get(node.id) || 0;
      groups.set(d, [...(groups.get(d) || []), node]);
    });

    const leftInset = panelGap + (paletteCollapsed ? 56 : 272) + 36;
    const rightInset = panelGap + (resultsCollapsed ? 56 : resultsWidth) + 36;
    const topInset = panelTopOffset + 34;
    const bottomInset = panelGap + 34;
    const availableWidth = Math.max(540, window.innerWidth - leftInset - rightInset);
    const availableHeight = Math.max(420, window.innerHeight - topInset - bottomInset);
    const columnCount = Math.max(groups.size, 1);
    const columnGap = columnCount > 1 ? Math.min(280, Math.max(210, availableWidth / Math.max(columnCount - 1, 1))) : 0;
    const rowGap = Math.min(170, Math.max(138, availableHeight / Math.max(nodes.length, 3)));

    const nextNodes = nodes.map((node) => {
      const d = depth.get(node.id) || 0;
      const group = groups.get(d) || [];
      const i = group.findIndex((item) => item.id === node.id);
      const stackHeight = Math.max(0, (group.length - 1) * rowGap);
      const startY = topInset + Math.max(0, (availableHeight - stackHeight) / 2);
      return {
        ...node,
        position: {
          x: leftInset + d * columnGap,
          y: startY + i * rowGap
        }
      };
    });

    setNodes(nextNodes);
    window.setTimeout(() => fitView({ padding: 0.08, duration: 450, minZoom: 0.42, maxZoom: 1.2 }), 60);
  };

  const graphPayload = (): FlowGraph => ({ nodes, edges, meta: { datasetId, targetColumn, taskType, analysisBoard: serializeAnalysisBoardTabs(analysisBoards).find((tab) => tab.id === MAIN_ANALYSIS_BOARD_ID)?.items || [], analysisBoards: serializeAnalysisBoardTabs(analysisBoards), activeAnalysisBoardId: activeBoardId } });

  const exportCurrentWorkflow = () => {
    exportWorkflowJson(workflowName, graphPayload());
    setMessage('فایل JSON جریان دانلود شد');
  };

  const saveWorkflow = async () => {
    if (!workflowName.trim()) { setMessage('نام جریان را وارد کنید'); return; }
    setBusy(true);
    try {
      const payload = { name: workflowName.trim(), graph: graphPayload() as unknown as Record<string, unknown>, project_id: projectId };
      const saved = currentWorkflowId ? await api.updateWorkflow(currentWorkflowId, payload) : await api.createWorkflow(payload);
      setCurrentWorkflowId(saved.id); await refreshWorkflows(); setMessage('جریان ذخیره شد');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'ذخیره ناموفق بود'); }
    finally { setBusy(false); }
  };

  const loadWorkflow = async (idValue: string) => {
    const id = Number(idValue) || null;
    setCurrentWorkflowId(id);
    if (!id) return;
    try {
      const workflow = await api.getWorkflow(id);
      const graph = workflow.graph as unknown as FlowGraph;
      setWorkflowName(workflow.name);
      setNodes(normalizeFlowNodes(graph.nodes || [], registry, catalog.aliases)); setEdges((graph.edges || []).map((edge) => ({ ...edge, animated: true })));
      setDatasetId(graph.meta?.datasetId ?? null); setTargetColumn(graph.meta?.targetColumn || 'target'); setTaskType(graph.meta?.taskType || 'auto');
      const restoredBoards = restoreAnalysisBoardTabs(graph.meta?.analysisBoards, graph.meta?.analysisBoard);
      const restoredActiveId = restoredBoards.some((tab) => tab.id === graph.meta?.activeAnalysisBoardId) ? String(graph.meta?.activeAnalysisBoardId) : MAIN_ANALYSIS_BOARD_ID;
      setAnalysisBoards(restoredBoards);
      setActiveBoardId(restoredActiveId);
      setBoardTargetId(restoredActiveId);
      setAnalysisBoardOpen(false);
      setLastRunSignature('');
      setSelectedId(null); setSelectedEdgeId(null); setMessage('جریان بارگذاری شد');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'بارگذاری ناموفق بود'); }
  };

  const newWorkflow = () => {
    const graph = defaultGraph(registry, catalog.aliases);
    setCurrentWorkflowId(null); setWorkflowName('جریان IOTA ML'); setNodes(graph.nodes); setEdges(graph.edges); setTargetColumn('target'); setTaskType('auto'); setAnalysisBoards([createMainAnalysisBoard()]); setActiveBoardId(MAIN_ANALYSIS_BOARD_ID); setBoardTargetId(MAIN_ANALYSIS_BOARD_ID); setAnalysisBoardOpen(false); setLastRunSignature(''); setCurrentRun(null); setSelectedId(null); setSelectedEdgeId(null);
  };

  const runGraphFromNode = async (nodeId: string | null) => {
    const graphToRun = connectedGraph(nodes, edges, nodeId);
    if (nodeId) {
      setSelectedId(nodeId);
      setSelectedIds([nodeId]);
      setSelectedEdgeId(null);
      setSelectedEdgeIds([]);
    }
    setBusy(true);
    setMessage(graphToRun.mode === 'selected' ? 'جریان متصل به نود انتخاب‌شده اجرا می‌شود' : 'کل برد اجرا می‌شود');
    try {
      const graph = { nodes: graphToRun.nodes, edges: graphToRun.edges, meta: { datasetId, targetColumn, taskType } };
      const run = await api.createRun({ workflow_name: workflowName, workflow_graph: graph, dataset_id: datasetId, project_id: projectId, target_column: targetColumn, task_type: taskType || 'auto', idempotency_key: crypto.randomUUID() });
      setCurrentRun(run);
      setRunHistory((items) => upsertRunSummary(items, run));
      setLastRunSignature(currentOutputSignature);
      setMessage('جریان در صف اجرا قرار گرفت');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'اجرا ناموفق بود'); setBusy(false); }
  };

  const runWorkflow = () => runGraphFromNode(selectedId);

  const retryRun = async (run: RunReference) => {
    setBusy(true);
    setMessage('اجرای قبلی دوباره در صف قرار گرفت');
    try {
      const nextRun = await api.retryRun(run.id);
      setCurrentRun(nextRun);
      setRunHistory((items) => upsertRunSummary(items, nextRun));
      setLastRunSignature(currentOutputSignature);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'اجرای دوباره ناموفق بود'); setBusy(false); }
  };

  const cancelRun = async (run: RunReference) => {
    if (terminalRunStatuses.has(run.status)) return;
    setMessage('درخواست توقف اجرا ارسال شد');
    try {
      const cancelled = await api.cancelRun(run.id);
      setCurrentRun(cancelled);
      setRunHistory((items) => upsertRunSummary(items, cancelled));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'توقف اجرا ناموفق بود'); }
  };

  useEffect(() => {
    const runId = currentRun?.id;
    if (!runId || terminalRunStatuses.has(currentRun.status)) {
      setBusy(false);
      return undefined;
    }

    let cancelled = false;
    let timer = 0;

    const poll = async () => {
      try {
        const snapshot = await api.runProgress(runId);
        if (cancelled) return;

        if (terminalRunStatuses.has(snapshot.status)) {
          const completed = await api.getRun(runId);
          if (cancelled) return;
          setCurrentRun(completed);
          setRunHistory((items) => upsertRunSummary(items, completed));
          setBusy(false);
          void refreshRunHistory();
          return;
        }

        setCurrentRun((run) => run && run.id === runId ? mergeRunProgress(run, snapshot) : run);
        timer = window.setTimeout(poll, snapshot.status === 'queued' ? 140 : 250);
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : 'دریافت وضعیت اجرا ناموفق بود');
        timer = window.setTimeout(poll, 700);
      }
    };

    timer = window.setTimeout(poll, 40);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentRun?.id, currentRun?.status, refreshRunHistory]);

  const selectHistoricalRun = useCallback(async (run: RunSummary) => {
    setMessage('در حال دریافت خروجی اجرای قبلی…');
    try {
      const fullRun = await api.getRun(run.id);
      setCurrentRun(fullRun);
      setBusy(!terminalRunStatuses.has(fullRun.status));
      setMessage('خروجی اجرای قبلی برای Debug نمایش داده شد');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'دریافت اجرای قبلی ناموفق بود');
    }
  }, []);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resultsCollapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = resultsWidth;
    const move = (moveEvent: PointerEvent) => setResultsWidth(Math.min(760, Math.max(300, startWidth + (startX - moveEvent.clientX))));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const appStyle = {
    ['--theme-results-panel-width' as string]: resultsCollapsed ? '46px' : `${resultsWidth}px`,
    ['--workflow-results-width' as string]: `${resultsWidth}px`
  };
  const flowNodes = useMemo(() => nodes.map((node) => ({ ...node, data: { ...node.data, onRename: renameNode } })), [nodes, renameNode]);

  const topbarHeight = 54;
  const panelGap = 16;
  const panelTopOffset = topbarHeight + 22;

  const floatingTopbarStyle = {
    position: 'fixed' as const,
    top: '14px',
    left: '16px',
    right: '16px',
    zIndex: 40,
    minHeight: `${topbarHeight}px`,
    padding: '6px 12px',
    borderRadius: '16px',
    background: 'var(--theme-panel-bg)',
    border: '1px solid var(--theme-divider)',
    boxShadow: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    overflow: 'hidden'
  };

  const topbarLeftStyle = {
    position: 'absolute' as const,
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '6px',
    minWidth: 0,
    maxWidth: 'calc(50% - 220px)',
    zIndex: 2
  };

  const topbarCenterStyle = {
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    minWidth: 0,
    zIndex: 1
  };

  const topbarRightStyle = {
    position: 'absolute' as const,
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '6px',
    minWidth: 0,
    maxWidth: 'calc(50% - 220px)',
    overflow: 'hidden',
    flexWrap: 'nowrap' as const,
    zIndex: 2
  };

  const floatingWorkspaceStyle = {
    position: 'relative' as const,
    height: '100vh',
    minHeight: '100vh',
    padding: 0,
    overflow: 'hidden'
  };

  const floatingLeftStyle = {
    position: 'fixed' as const,
    top: `${panelTopOffset}px`,
    left: `${panelGap}px`,
    bottom: `${panelGap}px`,
    zIndex: 30,
    width: paletteCollapsed ? '52px' : '272px',
    borderRadius: '16px',
    overflow: paletteCollapsed ? 'visible' : 'hidden',
    background: 'var(--theme-panel-bg)',
    border: '1px solid var(--theme-divider)',
    boxShadow: 'none'
  };

  const floatingRightStyle = {
    position: 'fixed' as const,
    top: `${panelTopOffset}px`,
    right: `${panelGap}px`,
    bottom: resultsCollapsed ? 'auto' : `${panelGap}px`,
    height: resultsCollapsed ? 'auto' : undefined,
    zIndex: 30,
    width: resultsCollapsed ? '52px' : `${resultsWidth}px`,
    borderRadius: '16px',
    overflow: 'hidden',
    background: 'var(--theme-panel-bg)',
    border: '1px solid var(--theme-divider)',
    boxShadow: 'none'
  };

  const floatingBoardStyle = {
    position: 'absolute' as const,
    inset: 0,
    margin: 0,
    borderRadius: 0,
    overflow: 'hidden',
    zIndex: 1
  };

  return (
    <div className="app-shell workflow-shell-page" style={appStyle}>
      <style>{`
        .left-stack.left-stack-collapsed .palette-flyout {
          left: calc(100% + 8px) !important;
          right: auto !important;
        }
      `}</style>
      <header className="topbar workflow-topbar workflow-topbar-pro" dir="ltr" style={floatingTopbarStyle}>
        <div className="workflow-topbar-left" style={topbarLeftStyle}>
          <button className="icon-button icon-only topbar-danger-action" type="button" onClick={onLogout} title="خروج" aria-label="خروج"><LogOut size={14} /></button>
          <button className="icon-button icon-only" type="button" onClick={onProfile} title="پروفایل" aria-label="پروفایل"><UserCircle size={14} /></button>
          <ThemeToggle />
          <button className="icon-button icon-only" type="button" onClick={onProjects} title="پنل پروژه‌ها" aria-label="پنل پروژه‌ها"><LayoutDashboard size={14} /></button>
          <button className="icon-button icon-only" type="button" onClick={onBack} title="بازگشت به پروژه" aria-label="بازگشت به پروژه"><ArrowRight size={14} /></button>
          {currentRun && !terminalRunStatuses.has(currentRun.status) && <button className="icon-button icon-only topbar-danger-action" type="button" onClick={() => cancelRun(currentRun)} title="توقف اجرا" aria-label="توقف اجرا"><Square size={13} /></button>}
          <button className="icon-button icon-only" type="button" onClick={exportCurrentWorkflow} title="Export workflow JSON" aria-label="Export workflow JSON"><Download size={14} /></button>
          <button className="icon-button icon-only" type="button" onClick={prettyLayout} title="چیدمان خودکار" aria-label="چیدمان خودکار"><LayoutGrid size={14} /></button>
          <button className="icon-button icon-only topbar-danger-action" title="حذف" aria-label="حذف" type="button" disabled={!selectedId && !selectedEdgeId && selectedIds.length === 0 && selectedEdgeIds.length === 0} onClick={deleteSelected}><Trash2 size={14} /></button>
          <button className="icon-button icon-only" type="button" onClick={newWorkflow} title="جریان جدید" aria-label="جریان جدید"><PlusCircle size={14} /></button>
          <button className="icon-button icon-only" type="button" title="بیشتر" aria-label="بیشتر"><MoreHorizontal size={14} /></button>
        </div>

        <div className="workflow-topbar-center" style={topbarCenterStyle}>
          <button className="icon-button icon-only topbar-primary-action" title={selectedNode ? 'اجرای مسیر نود انتخاب‌شده' : 'اجرای برد'} aria-label="اجرا" disabled={busy || nodes.length === 0} onClick={runWorkflow}>{busy ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}</button>
          <button className={`icon-button icon-only ${analysisBoardOpen ? 'active' : ''}`} type="button" onClick={() => setAnalysisBoardOpen((value) => !value)} title={analysisBoardOpen ? 'بازگشت به Workflow' : 'Analysis Board'} aria-label={analysisBoardOpen ? 'بازگشت به Workflow' : 'Analysis Board'}><BoardIcon size={14} /></button>
          <button className="icon-button icon-only topbar-primary-action" type="button" disabled={busy} onClick={saveWorkflow} title="ذخیره" aria-label="ذخیره"><Save size={14} /></button>
        </div>

        <div className="workflow-topbar-right" style={topbarRightStyle}>
          <input className="workflow-name-input" style={{ width: '168px', minWidth: '120px', height: '32px' }} value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} aria-label="نام جریان" placeholder="نام جریان" />
          {/* <div style={{ width: '164px', minWidth: '132px' }}><CustomSelect className="workflow-select" value={currentWorkflowId ? String(currentWorkflowId) : ''} options={workflowOptions} onChange={loadWorkflow} ariaLabel="لیست جریان‌ها" /></div> */}
          <div className="workflow-breadcrumb workflow-logo-breadcrumb" dir="rtl">
            <div className="workflow-logo-title">
              <img src="/iota.png" alt="IOTA" />
              <h2>IOTA ML</h2>
            </div>
            <h1>›</h1>
            <h3>{project.name}</h3>
          </div>
        </div>
      </header>

      <main className={`workspace ${paletteCollapsed ? 'palette-collapsed' : ''} ${resultsCollapsed ? 'results-collapsed' : ''}`} style={floatingWorkspaceStyle}>
        {analysisBoardOpen ? (
          <WorkflowNodesList
            nodes={nodes}
            selectedId={selectedId}
            collapsed={paletteCollapsed}
            setCollapsed={setPaletteCollapsed}
            floatingLeftStyle={floatingLeftStyle}
            onSelectNode={selectWorkflowNode}
          />
        ) : (
          <NodeMenu
            registry={registry}
            paletteCollapsed={paletteCollapsed}
            setPaletteCollapsed={setPaletteCollapsed}
            floatingLeftStyle={floatingLeftStyle}
            onCreateCustomNode={openCustomNodeBuilder}
            onEditCustomNode={editCustomNode}
          />
        )}
        <section className="board" onDrop={onDrop} onDragOver={onDragOver} style={floatingBoardStyle}>
          {message && <div className="toast">{message}</div>}
          <div className={`workflow-flow-layer ${analysisBoardOpen ? 'is-hidden' : ''}`}>
            <ReactFlow nodes={flowNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onSelectionChange={onSelectionChange} onNodeClick={onNodeClick} onNodeDoubleClick={onNodeDoubleClick} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick} selectionOnDrag multiSelectionKeyCode={multiSelectionKeys} onlyRenderVisibleElements fitView>
              <Controls /><MiniMap className="workflow-minimap-visible" pannable zoomable style={{ left: paletteCollapsed ? 76 : 304, right: 'auto', bottom: 24 }} />
            </ReactFlow>
          </div>
          {analysisBoardOpen && (
            <AnalysisBoard
              tabs={analysisBoards}
              activeBoardId={activeBoardId}
              items={analysisBoardItems}
              run={currentRun}
              busy={busy}
              workflowDirty={workflowDirtyForBoard}
              onClose={() => setAnalysisBoardOpen(false)}
              onRun={runWorkflow}
              onSelectBoard={(id) => { setActiveBoardId(id); setBoardTargetId(id); }}
              onCreateBoard={createAnalysisBoard}
              onRenameBoard={renameAnalysisBoard}
              onRemoveBoard={removeAnalysisBoard}
              onAddOutput={(output, index) => addOutputToBoard(output, index, activeBoardId)}
              onUpdateItem={updateBoardItem}
              onRemoveItem={removeBoardItem}
              onDuplicateItem={duplicateBoardItem}
              onClear={clearActiveBoard}
            />
          )}
        </section>
        <RightPanel
          floatingRightStyle={floatingRightStyle}
          resultsCollapsed={resultsCollapsed}
          setResultsCollapsed={setResultsCollapsed}
          startResize={startResize}
          selectedFlow={selectedFlow}
          historyCollapsed={historyCollapsed}
          setHistoryCollapsed={setHistoryCollapsed}
          runHistory={runHistory}
          currentRun={currentRun}
          busy={busy}
          retryRun={retryRun}
          cancelRun={cancelRun}
          selectHistoricalRun={selectHistoricalRun}
          refreshRunHistory={refreshRunHistory}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          registry={registry}
          aliases={catalog.aliases}
          datasets={datasets}
          availableColumns={availableColumns}
          updateNodeParams={updateNodeParams}
          renameNode={renameNode}
          deleteSelected={deleteSelected}
          nodeResultsCollapsed={nodeResultsCollapsed}
          setNodeResultsCollapsed={setNodeResultsCollapsed}
          quickSettingsCollapsed={quickSettingsCollapsed}
          setQuickSettingsCollapsed={setQuickSettingsCollapsed}
          selectedId={selectedId}
          onAddOutputToBoard={addOutputFromRightPanel}
          analysisBoardOpen={analysisBoardOpen}
          boardTabs={analysisBoards}
          boardTargetId={analysisBoardOpen ? boardTargetId : MAIN_ANALYSIS_BOARD_ID}
          onBoardTargetChange={(id) => { setBoardTargetId(id); setActiveBoardId(id); }}
        />
      </main>
      {modalNode && <NodeModal node={modalNode} edges={edges} registry={registry} aliases={catalog.aliases} datasets={datasets} availableColumns={availableColumns} run={currentRun} busy={busy} onRunNode={() => runGraphFromNode(modalNode.id)} onParamsChange={updateNodeParams} onRename={renameNode} onPinnedChange={updateNodePinned} onAddOutputToBoard={addOutputToMainBoard} onClose={() => setModalNodeId(null)} />}
      {customBuilderOpen && <CustomNodeBuilder definition={customBuilderDefinition} workflowNodes={nodes} registry={registry} busy={customBuilderBusy} onSave={saveCustomNode} onDelete={customBuilderDefinition ? deleteCustomNode : undefined} onClose={() => { if (!customBuilderBusy) { setCustomBuilderOpen(false); setCustomBuilderDefinition(null); } }} />}
    </div>
  );
}

export function WorkflowPage(props: WorkflowPageProps) {
  return (
    <ReactFlowProvider>
      <WorkflowEditor {...props} />
    </ReactFlowProvider>
  );
}
