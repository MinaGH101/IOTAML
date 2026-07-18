import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
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
import { ArrowLeft, Download, KanbanSquare, Layers3, LayoutDashboard, LayoutGrid, LogOut, Pencil, Play, RefreshCw, Save, SlidersHorizontal, Square, Trash2, UserCircle } from 'lucide-react';
import { ApiError, api } from '../api';
import { CustomNodeBuilder } from '../components/CustomNodeBuilder';
import { AnalysisBoard, type AnalysisBoardItem, type AnalysisBoardTab, type BoardViewport } from '../components/AnalysisBoard';
import { AppDialog, ConfirmDialog } from '../components/AppDialog';
import { ComponentVersionDialog, CreateComponentDialog, type ComponentDefinitionDraft } from '../components/WorkflowComponentDialogs';
import { ComponentDefinitionEditorDialog } from '../components/ComponentDefinitionEditorDialog';
import { ComponentVersionsDialog, type ComponentVersionAction } from '../components/ComponentVersionsDialog';
import { WorkflowVersionDialog } from '../components/WorkflowVersionDialog';
import { NodeModal } from '../components/NodeModal';
import { ThemeToggle } from '../components/ThemeToggle';
import { normalizeOutputs, type Output } from '../components/ResultsPanel';
import { NodeMenu } from './NodeMenu';
import { WorkflowNodesList } from './WorkflowNodesList';
import { RightPanel } from './RightPanel';
import { MlNode } from '../nodes/MlNode';
import type { ComponentBoundaryPort, ComponentVersion, ComponentVersionSummary, CustomNodeDefinition, CustomNodePayload, Dataset, NodeCatalogResponse, Project, RegistryNode, Run, RunProgressSnapshot, RunSummary, UserProfile, Workflow, WorkflowComponent, WorkflowVersion, WorkflowVersionSummary } from '../types';
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
  normalizeEdgeHandles,
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

function outputsForIncomingEdge(outputs: Output[], edge: Edge, nodes: Node[]) {
  const candidates = outputs.filter((item) => String(item.node_id || '') === edge.source);
  if (!candidates.length) return [] as Output[];
  const selectedHandle = String(edge.sourceHandle || '');
  const annotated = candidates.filter((item) => String(item.source_handle || '').trim());
  if (selectedHandle) {
    const exact = candidates.filter((item) => String(item.source_handle || '') === selectedHandle);
    if (exact.length) return exact;
    if (annotated.length) return [];
  }
  const sourceNode = nodes.find((item) => item.id === edge.source);
  const ports = (sourceNode?.data?.outputs || []) as Array<{ id?: string }>;
  if (ports.length <= 1 || annotated.length === 0) return candidates;
  const fallbackHandle = String(ports[0]?.id || '');
  return candidates.filter((item) => String(item.source_handle || '') === fallbackHandle);
}

function columnsFromOutputs(outputs: Output[]) {
  for (let index = outputs.length - 1; index >= 0; index -= 1) {
    const columns = outputs[index]?.columns;
    if (Array.isArray(columns)) return columns.map(String);
    const rows = outputs[index]?.rows;
    if (Array.isArray(rows) && rows.length && rows[0] && typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
      return Object.keys(rows[0] as Record<string, unknown>);
    }
  }
  return [] as string[];
}

function rowsFromOutputs(outputs: Output[]) {
  for (let index = outputs.length - 1; index >= 0; index -= 1) {
    const rows = outputs[index]?.rows;
    if (Array.isArray(rows) && rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
      return rows as Record<string, unknown>[];
    }
  }
  return [] as Record<string, unknown>[];
}

function mergeRunProgress(run: Run, snapshot: RunProgressSnapshot): Run {
  const currentProgress = run.progress || {};
  const nextProgress = snapshot.progress || {};
  const progressUnchanged = currentProgress.updated_at === nextProgress.updated_at
    && currentProgress.percent === nextProgress.percent
    && currentProgress.nodes_finished === nextProgress.nodes_finished
    && currentProgress.nodes_total === nextProgress.nodes_total
    && currentProgress.current_node_id === nextProgress.current_node_id;
  const nodesUnchanged = JSON.stringify(run.node_statuses || {}) === JSON.stringify(snapshot.node_statuses || {});

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

function componentDraftSignature(nodes: Node[], edges: Edge[], version: Pick<ComponentVersion, 'interface_json' | 'exposed_parameters'>) {
  return JSON.stringify({
    nodes: nodes.map((node) => ({ ...node, selected: false, dragging: false })),
    edges: edges.map((edge) => ({ ...edge, selected: false })),
    interface: version.interface_json,
    exposed: version.exposed_parameters,
  });
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
  const [ctrlSelectionActive, setCtrlSelectionActive] = useState(false);
  const [modalNodeId, setModalNodeId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState('جریان IOTA ML');
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [targetColumn, setTargetColumn] = useState('target');
  const [taskType, setTaskType] = useState('auto');
  const [currentRun, setCurrentRun] = useState<Run | null>(null);
  const [workflowLastRunId, setWorkflowLastRunId] = useState<number | null>(null);
  const [runHistory, setRunHistory] = useState<RunSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [resultsWidth, setResultsWidth] = useState(380);
  const [resultsCollapsed, setResultsCollapsed] = useState(false);
  const [analysisBoardOpen, setAnalysisBoardOpen] = useState(false);
  const [analysisBoards, setAnalysisBoards] = useState<AnalysisBoardTab[]>(() => [createMainAnalysisBoard()]);
  const [activeBoardId, setActiveBoardId] = useState(MAIN_ANALYSIS_BOARD_ID);
  const [boardTargetId, setBoardTargetId] = useState(MAIN_ANALYSIS_BOARD_ID);
  const [lastRunSignature, setLastRunSignature] = useState('');
  const [customBuilderDefinition, setCustomBuilderDefinition] = useState<CustomNodeDefinition | null>(null);
  const [customBuilderOpen, setCustomBuilderOpen] = useState(false);
  const [customBuilderBusy, setCustomBuilderBusy] = useState(false);
  const [workflowRevision, setWorkflowRevision] = useState(1);
  const [workflowVersions, setWorkflowVersions] = useState<WorkflowVersionSummary[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [versionPreview, setVersionPreview] = useState<WorkflowVersion | null>(null);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const [autosaveUpdatedAt, setAutosaveUpdatedAt] = useState<string | null>(null);
  const [versionBusy, setVersionBusy] = useState(false);
  const [workflowVersionDialogOpen, setWorkflowVersionDialogOpen] = useState(false);
  const [components, setComponents] = useState<WorkflowComponent[]>([]);
  const [componentBusy, setComponentBusy] = useState(false);
  const [createComponentOpen, setCreateComponentOpen] = useState(false);
  const [componentBoundary, setComponentBoundary] = useState<{ inputs: ComponentBoundaryPort[]; outputs: ComponentBoundaryPort[] }>({ inputs: [], outputs: [] });
  const [componentVersionDialogOpen, setComponentVersionDialogOpen] = useState(false);
  const [componentEditor, setComponentEditor] = useState<{ component: WorkflowComponent; version: ComponentVersion; parentNodes: Node[]; parentEdges: Edge[]; sourceNodeId: string | null; baselineSignature: string } | null>(null);
  const [confirmDeleteComponent, setConfirmDeleteComponent] = useState<WorkflowComponent | null>(null);
  const [confirmUngroupComponent, setConfirmUngroupComponent] = useState<Node | null>(null);
  const [componentDefinitionDialogOpen, setComponentDefinitionDialogOpen] = useState(false);
  const [managedComponent, setManagedComponent] = useState<WorkflowComponent | null>(null);
  const [managedComponentVersions, setManagedComponentVersions] = useState<ComponentVersionSummary[]>([]);
  const [confirmDeleteComponentVersion, setConfirmDeleteComponentVersion] = useState<ComponentVersionAction | null>(null);
  const [pendingComponentUpgrade, setPendingComponentUpgrade] = useState<{ component: WorkflowComponent; version: ComponentVersion; registryNode: RegistryNode } | null>(null);
  const [confirmLeaveComponentEditor, setConfirmLeaveComponentEditor] = useState(false);
  const [renameBoardDialogOpen, setRenameBoardDialogOpen] = useState(false);
  const [renameBoardDraft, setRenameBoardDraft] = useState('');
  const [deleteBoardDialogOpen, setDeleteBoardDialogOpen] = useState(false);

  const workflowIdRef = useRef<number | null>(null);
  const workflowRevisionRef = useRef(1);
  const autosaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const lastSavedSignatureRef = useRef('');
  const skipNextAutosaveRef = useRef(true);
  const editorSessionRef = useRef(1);

  const refreshRegistry = useCallback(async () => setCatalog(await api.nodeCatalog()), []);
  const refreshWorkflows = useCallback(async () => setWorkflows(await api.workflows(projectId)), [projectId]);
  const refreshRunHistory = useCallback(async () => setRunHistory(await api.listRuns(projectId)), [projectId]);
  const refreshWorkflowVersions = useCallback(async (workflowId = workflowIdRef.current) => {
    if (!workflowId) {
      setWorkflowVersions([]);
      return [];
    }
    const versions = await api.workflowVersions(workflowId);
    setWorkflowVersions(versions);
    return versions;
  }, []);

  const applyGraphToEditor = useCallback((graph: FlowGraph, nodeRegistry: RegistryNode[], aliases: Record<string, string>) => {
    const normalizedNodes = normalizeFlowNodes(graph.nodes || [], nodeRegistry, aliases);
    setNodes(normalizedNodes);
    setEdges(normalizeEdgeHandles(normalizedNodes, graph.edges || []).map((edge) => ({ ...edge, animated: true })));
    setDatasetId(graph.meta?.datasetId ?? null);
    setTargetColumn(graph.meta?.targetColumn || 'target');
    setTaskType(graph.meta?.taskType || 'auto');
    const restoredBoards = restoreAnalysisBoardTabs(graph.meta?.analysisBoards, graph.meta?.analysisBoard);
    const requestedBoardId = String(graph.meta?.activeAnalysisBoardId || MAIN_ANALYSIS_BOARD_ID);
    const restoredActiveId = restoredBoards.some((tab) => tab.id === requestedBoardId) ? requestedBoardId : MAIN_ANALYSIS_BOARD_ID;
    setAnalysisBoards(restoredBoards);
    setActiveBoardId(restoredActiveId);
    setBoardTargetId(restoredActiveId);
    setAnalysisBoardOpen(false);
    setSelectedId(null);
    setSelectedIds([]);
    setSelectedEdgeId(null);
    setSelectedEdgeIds([]);
    setModalNodeId(null);
  }, []);

  const refreshComponents = useCallback(async () => {
    const items = await api.components(projectId);
    setComponents(items);
    return items;
  }, [projectId]);

  useEffect(() => {
    const updateSelectionModifier = (event: KeyboardEvent) => {
      setCtrlSelectionActive(event.ctrlKey || event.metaKey);
    };
    const clearSelectionModifier = () => setCtrlSelectionActive(false);
    window.addEventListener('keydown', updateSelectionModifier);
    window.addEventListener('keyup', updateSelectionModifier);
    window.addEventListener('blur', clearSelectionModifier);
    return () => {
      window.removeEventListener('keydown', updateSelectionModifier);
      window.removeEventListener('keyup', updateSelectionModifier);
      window.removeEventListener('blur', clearSelectionModifier);
    };
  }, []);

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
    const mobile = window.matchMedia('(max-width: 760px)');
    const collapseFloatingPanels = () => {
      if (!mobile.matches) return;
      setPaletteCollapsed(true);
      setResultsCollapsed(true);
    };
    collapseFloatingPanels();
    mobile.addEventListener('change', collapseFloatingPanels);
    return () => mobile.removeEventListener('change', collapseFloatingPanels);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.nodeCatalog(), api.datasets(projectId), api.workflows(projectId), api.listRuns(projectId), api.components(projectId)])
      .then(async ([catalogData, datasetList, workflowList, runList, componentList]) => {
        if (!alive) return;
        const nodeRegistry = catalogData.nodes;
        setCatalog(catalogData);
        setDatasets(datasetList);
        setWorkflows(workflowList);
        setRunHistory(runList);
        setComponents(componentList);
        setDatasetId(datasetList[0]?.id ?? null);

        if (initialWorkflowId) {
          const workflow = await api.getWorkflow(initialWorkflowId);
          const [versions, lastRun] = await Promise.all([
            api.workflowVersions(workflow.id).catch(() => [] as WorkflowVersionSummary[]),
            workflow.last_run_id ? api.getRun(workflow.last_run_id).catch(() => null) : Promise.resolve(null),
          ]);
          if (!alive) return;
          const graph = workflow.graph as unknown as FlowGraph;
          workflowIdRef.current = workflow.id;
          workflowRevisionRef.current = workflow.revision;
          setCurrentWorkflowId(workflow.id);
          setWorkflowRevision(workflow.revision);
          setWorkflowName(workflow.name);
          setWorkflowVersions(versions);
          setAutosaveUpdatedAt(workflow.last_autosaved_at || workflow.updated_at);
          setAutosaveState('saved');
          setVersionPreview(null);
          setSelectedVersionId(null);
          applyGraphToEditor(graph, nodeRegistry, catalogData.aliases);
          if (graph.meta?.datasetId == null) setDatasetId(datasetList[0]?.id ?? null);
          setCurrentRun(lastRun);
          setWorkflowLastRunId(workflow.last_run_id ?? null);
          setLastRunSignature('');
          lastSavedSignatureRef.current = '';
          skipNextAutosaveRef.current = true;
          setMessage('جریان بارگذاری شد');
          return;
        }

        const graph = defaultGraph(nodeRegistry, catalogData.aliases);
        workflowIdRef.current = null;
        workflowRevisionRef.current = 1;
        setCurrentWorkflowId(null);
        setWorkflowRevision(1);
        setWorkflowVersions([]);
        setVersionPreview(null);
        setSelectedVersionId(null);
        setWorkflowName('جریان IOTA ML');
        setNodes(graph.nodes);
        setEdges(graph.edges);
        setAnalysisBoards([createMainAnalysisBoard()]);
        setActiveBoardId(MAIN_ANALYSIS_BOARD_ID);
        setBoardTargetId(MAIN_ANALYSIS_BOARD_ID);
        setAnalysisBoardOpen(false);
        setCurrentRun(null);
        setWorkflowLastRunId(null);
        setLastRunSignature('');
        setAutosaveState('idle');
        setAutosaveUpdatedAt(null);
        lastSavedSignatureRef.current = '';
        skipNextAutosaveRef.current = true;
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'بارگذاری پروژه ناموفق بود'));
    return () => { alive = false; };
  }, [applyGraphToEditor, initialWorkflowId, projectId]);

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedId) || null, [nodes, selectedId]);
  const selectedEdge = useMemo(() => edges.find((edge) => edge.id === selectedEdgeId) || null, [edges, selectedEdgeId]);
  const selectedFlow = useMemo(() => connectedGraph(nodes, edges, selectedId), [nodes, edges, selectedId]);
  const modalNode = useMemo(() => nodes.find((node) => node.id === modalNodeId) || null, [nodes, modalNodeId]);
  const componentEditorDirty = useMemo(() => Boolean(componentEditor && componentDraftSignature(nodes, edges, componentEditor.version) !== componentEditor.baselineSignature), [componentEditor, edges, nodes]);

  const allRunOutputs = useMemo(() => normalizeOutputs(currentRun, null), [currentRun]);
  const editorNodeId = modalNodeId || selectedId;
  const editorIncomingEdges = useMemo(() => editorNodeId ? edges.filter((edge) => edge.target === editorNodeId) : [], [edges, editorNodeId]);
  const editorInputOutputs = useMemo(() => editorIncomingEdges.flatMap((edge) => outputsForIncomingEdge(allRunOutputs, edge, nodes)), [allRunOutputs, editorIncomingEdges, nodes]);
  const runtimeInputResolved = useMemo(() => editorIncomingEdges.some((edge) => allRunOutputs.some((output) => String(output.node_id || '') === edge.source)), [allRunOutputs, editorIncomingEdges]);
  const availableColumns = useMemo(() => {
    const runtimeColumns = columnsFromOutputs(editorInputOutputs);
    if (runtimeInputResolved) return runtimeColumns;
    return inputColumnsForNode(editorNodeId, nodes, edges, datasets, datasetId, catalog.aliases);
  }, [catalog.aliases, datasetId, datasets, edges, editorInputOutputs, editorNodeId, nodes, runtimeInputResolved]);
  const availableRows = useMemo(() => rowsFromOutputs(editorInputOutputs), [editorInputOutputs]);
  const currentOutputSignature = useMemo(() => workflowOutputSignature(nodes, edges, datasetId, targetColumn, taskType), [nodes, edges, datasetId, targetColumn, taskType]);
  const workflowDirtyForBoard = Boolean(currentRun && lastRunSignature && currentOutputSignature !== lastRunSignature);
  const activeBoard = useMemo(() => analysisBoards.find((tab) => tab.id === activeBoardId) || analysisBoards[0], [analysisBoards, activeBoardId]);
  const analysisBoardItems = activeBoard?.items || [];

  const componentVersionFromSnapshot = useCallback((snapshot: Record<string, unknown>): ComponentVersion => ({
    id: Number(snapshot.version_id || 0),
    component_id: Number(snapshot.component_id || 0),
    version_number: Number(snapshot.version_number || 0),
    semantic_version: String(snapshot.semantic_version || '1.0.0'),
    name: String(snapshot.component_name || 'Component'),
    description: '',
    graph: (snapshot.graph || {}) as Record<string, unknown>,
    graph_hash: String(snapshot.graph_hash || ''),
    interface_json: (snapshot.interface || { inputs: [], outputs: [] }) as ComponentVersion['interface_json'],
    exposed_parameters: (snapshot.exposed_parameters || []) as ComponentVersion['exposed_parameters'],
    dependencies_json: (snapshot.dependencies || []) as ComponentVersion['dependencies_json'],
    changelog: '',
    owner_username: user.username,
    created_at: new Date().toISOString(),
  }), [user.username]);

  const enterComponentEditor = useCallback(async (component: WorkflowComponent, version: ComponentVersion, sourceNodeId: string | null = null) => {
    if (versionPreview || componentEditor) return;
    const graph = version.graph as unknown as FlowGraph;
    const editorNodes = normalizeFlowNodes(graph.nodes || [], registry, catalog.aliases);
    const editorEdges = (graph.edges || []).map((edge) => ({ ...edge, animated: true }));
    setComponentEditor({ component, version, parentNodes: nodes, parentEdges: edges, sourceNodeId, baselineSignature: componentDraftSignature(editorNodes, editorEdges, version) });
    setNodes(editorNodes);
    setEdges(editorEdges);
    setSelectedId(null);
    setSelectedIds([]);
    setSelectedEdgeId(null);
    setSelectedEdgeIds([]);
    setModalNodeId(null);
    setAnalysisBoardOpen(false);
    window.setTimeout(() => fitView({ padding: 0.12, duration: 300 }), 40);
  }, [catalog.aliases, componentEditor, edges, fitView, nodes, registry, versionPreview]);

  const enterComponentNode = useCallback(async (node: Node) => {
    const snapshot = node.data?.componentSnapshot as Record<string, unknown> | undefined;
    if (!snapshot) return false;
    const componentId = Number(snapshot.component_id || node.data?.componentId || 0);
    const versionId = Number(snapshot.version_id || node.data?.componentVersionId || 0);
    try {
      const component = components.find((item) => item.id === componentId) || await api.getComponent(componentId, projectId);
      const version = versionId ? await api.getComponentVersion(componentId, versionId, projectId).catch(() => componentVersionFromSnapshot(snapshot)) : componentVersionFromSnapshot(snapshot);
      await enterComponentEditor(component, version, node.id);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'باز کردن کامپوننت ناموفق بود');
      return false;
    }
  }, [componentVersionFromSnapshot, components, enterComponentEditor, projectId]);

  const leaveComponentEditor = useCallback(() => {
    if (!componentEditor) return;
    setNodes(componentEditor.parentNodes);
    setEdges(componentEditor.parentEdges);
    setComponentEditor(null);
    setComponentVersionDialogOpen(false);
    setComponentDefinitionDialogOpen(false);
    setConfirmLeaveComponentEditor(false);
    setSelectedId(null);
    setSelectedIds([]);
    setSelectedEdgeId(null);
    setSelectedEdgeIds([]);
    window.setTimeout(() => fitView({ padding: 0.1, duration: 260 }), 40);
  }, [componentEditor, fitView]);

  const requestLeaveComponentEditor = useCallback(() => {
    if (componentEditorDirty) {
      setConfirmLeaveComponentEditor(true);
      return;
    }
    leaveComponentEditor();
  }, [componentEditorDirty, leaveComponentEditor]);

  const selectedComponentBoundary = useCallback(() => {
    const selected = new Set(selectedIds);
    const selectedNodes = nodes.filter((node) => selected.has(node.id));
    if (selectedNodes.length < 2) return null;
    const internalEdges = edges.filter((edge) => selected.has(edge.source) && selected.has(edge.target));
    const adjacency = new Map<string, Set<string>>(selectedNodes.map((node) => [node.id, new Set<string>()]));
    internalEdges.forEach((edge) => {
      adjacency.get(edge.source)?.add(edge.target);
      adjacency.get(edge.target)?.add(edge.source);
    });
    const visited = new Set<string>();
    const queue = selectedNodes.length ? [selectedNodes[0].id] : [];
    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      adjacency.get(current)?.forEach((next) => { if (!visited.has(next)) queue.push(next); });
    }
    const disconnected = visited.size !== selectedNodes.length;
    const incoming = edges.filter((edge) => selected.has(edge.target) && !selected.has(edge.source));
    const outgoing = edges.filter((edge) => selected.has(edge.source) && !selected.has(edge.target));
    const portType = (nodeId: string, handle: string | null | undefined, side: 'inputs' | 'outputs') => {
      const node = nodes.find((item) => item.id === nodeId);
      const ports = (node?.data?.[side] || []) as Array<{ id: string; type?: string; name?: string }>;
      return ports.find((port) => port.id === String(handle || (side === 'inputs' ? 'input' : 'output')))?.type || ports[0]?.type || 'any';
    };
    const inputs: ComponentBoundaryPort[] = incoming.map((edge, index) => ({
      id: `input_${index + 1}`,
      name: String(edge.targetHandle || `Input ${index + 1}`),
      type: portType(edge.target, edge.targetHandle, 'inputs'),
      required: true,
      multiple: false,
      internal_node_id: edge.target,
      internal_handle: String(edge.targetHandle || 'input'),
    }));
    const outputs: ComponentBoundaryPort[] = outgoing.map((edge, index) => ({
      id: `output_${index + 1}`,
      name: String(edge.sourceHandle || `Output ${index + 1}`),
      type: portType(edge.source, edge.sourceHandle, 'outputs'),
      required: true,
      multiple: false,
      internal_node_id: edge.source,
      internal_handle: String(edge.sourceHandle || 'output'),
    }));
    return { selected, selectedNodes, internalEdges, incoming, outgoing, inputs, outputs, disconnected };
  }, [edges, nodes, selectedIds]);

  const openCreateComponent = useCallback(() => {
    if (versionPreview || componentEditor) return;
    const boundary = selectedComponentBoundary();
    if (!boundary) {
      setMessage('برای ساخت کامپوننت حداقل دو نود را انتخاب کنید.');
      return;
    }
    if (boundary.disconnected) {
      setMessage('نودهای انتخاب‌شده باید در یک گروه متصل باشند. گروه‌های جدا را به‌صورت کامپوننت‌های مستقل بسازید.');
      return;
    }
    setComponentBoundary({ inputs: boundary.inputs, outputs: boundary.outputs });
    setCreateComponentOpen(true);
  }, [componentEditor, selectedComponentBoundary, versionPreview]);

  const createComponentFromSelection = useCallback(async (draft: ComponentDefinitionDraft) => {
    const boundary = selectedComponentBoundary();
    if (!boundary || boundary.disconnected) return;
    setComponentBusy(true);
    try {
      const minX = Math.min(...boundary.selectedNodes.map((node) => node.position.x));
      const minY = Math.min(...boundary.selectedNodes.map((node) => node.position.y));
      const internalNodes = boundary.selectedNodes.map((node) => ({ ...node, selected: false, position: { x: node.position.x - minX + 80, y: node.position.y - minY + 80 } }));
      const internalEdges = boundary.internalEdges.map((edge) => ({ ...edge, selected: false }));
      const component = await api.createComponent({
        name: draft.name,
        description: draft.description,
        category: 'Components',
        icon: 'workflow',
        visibility: draft.visibility,
        project_id: draft.visibility === 'project' ? projectId : null,
        semantic_version: draft.semanticVersion,
        graph: { nodes: internalNodes, edges: internalEdges, meta: {} },
        interface: { inputs: draft.inputs, outputs: draft.outputs },
        exposed_parameters: draft.exposedParameters,
        changelog: 'Initial component',
      });
      const registryNode = await api.componentRegistry(component.id, projectId);
      const centerX = boundary.selectedNodes.reduce((sum, node) => sum + node.position.x, 0) / boundary.selectedNodes.length;
      const centerY = boundary.selectedNodes.reduce((sum, node) => sum + node.position.y, 0) / boundary.selectedNodes.length;
      const componentNode = makeNode(registryNode, nodes.length, { x: centerX, y: centerY });
      componentNode.data = { ...componentNode.data, label: component.name, typeLabel: component.name };
      const rewiredIncoming = boundary.incoming.map((edge, index) => ({ ...edge, id: `component-in-${componentNode.id}-${index}`, target: componentNode.id, targetHandle: draft.inputs[index]?.id || `input_${index + 1}`, animated: true }));
      const rewiredOutgoing = boundary.outgoing.map((edge, index) => ({ ...edge, id: `component-out-${componentNode.id}-${index}`, source: componentNode.id, sourceHandle: draft.outputs[index]?.id || `output_${index + 1}`, animated: true }));
      setNodes((items) => [...items.filter((node) => !boundary.selected.has(node.id)), componentNode]);
      setEdges((items) => [
        ...items.filter((edge) => !boundary.selected.has(edge.source) && !boundary.selected.has(edge.target)),
        ...rewiredIncoming,
        ...rewiredOutgoing,
      ]);
      setSelectedId(componentNode.id);
      setSelectedIds([componentNode.id]);
      setCreateComponentOpen(false);
      await Promise.all([refreshComponents(), refreshRegistry()]);
      setMessage(`کامپوننت «${component.name}» ساخته شد و در کتابخانه قرار گرفت.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ساخت کامپوننت ناموفق بود');
    } finally {
      setComponentBusy(false);
    }
  }, [edges, nodes.length, projectId, refreshComponents, refreshRegistry, selectedComponentBoundary]);

  const ungroupComponentInstance = useCallback((componentNode: Node) => {
    if (versionPreview || componentEditor) return;
    const snapshot = componentNode.data?.componentSnapshot as Record<string, unknown> | undefined;
    if (!snapshot) {
      setMessage('این نود یک کامپوننت قابل بازگردانی نیست.');
      return;
    }
    const graph = (snapshot.graph || {}) as FlowGraph;
    const sourceNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const sourceEdges = Array.isArray(graph.edges) ? graph.edges : [];
    if (sourceNodes.length === 0) {
      setMessage('گراف داخلی کامپوننت خالی است.');
      return;
    }

    const nonce = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const idMap = new Map(sourceNodes.map((node) => [String(node.id), `${componentNode.id}__expanded__${nonce}__${node.id}`]));
    const minX = Math.min(...sourceNodes.map((node) => Number(node.position?.x || 0)));
    const minY = Math.min(...sourceNodes.map((node) => Number(node.position?.y || 0)));
    const instanceParams = (componentNode.data?.params || {}) as Record<string, unknown>;
    const exposed = (snapshot.exposed_parameters || []) as ComponentVersion['exposed_parameters'];

    const expandedNodes = sourceNodes.map((sourceNode) => {
      const originalId = String(sourceNode.id);
      const data = { ...(sourceNode.data || {}) } as Record<string, unknown>;
      const params = { ...((data.params || {}) as Record<string, unknown>) };
      exposed.filter((item) => item.internal_node_id === originalId).forEach((item) => {
        params[item.internal_param] = Object.prototype.hasOwnProperty.call(instanceParams, item.id) ? instanceParams[item.id] : item.default;
      });
      data.params = params;
      return {
        ...sourceNode,
        id: idMap.get(originalId)!,
        selected: true,
        dragging: false,
        position: {
          x: componentNode.position.x + Number(sourceNode.position?.x || 0) - minX,
          y: componentNode.position.y + Number(sourceNode.position?.y || 0) - minY,
        },
        data,
      } as Node;
    });

    const expandedEdges = sourceEdges.map((sourceEdge, index) => ({
      ...sourceEdge,
      id: `${componentNode.id}__expanded-edge__${nonce}__${sourceEdge.id || index}`,
      source: idMap.get(String(sourceEdge.source))!,
      target: idMap.get(String(sourceEdge.target))!,
      selected: false,
      animated: true,
    })) as Edge[];

    const interfaceJson = (snapshot.interface || { inputs: [], outputs: [] }) as ComponentVersion['interface_json'];
    const inputById = new Map(interfaceJson.inputs.map((port) => [port.id, port]));
    const outputById = new Map(interfaceJson.outputs.map((port) => [port.id, port]));
    const outsideEdges = edges.filter((edge) => edge.source !== componentNode.id && edge.target !== componentNode.id);
    const incomingEdges = edges.filter((edge) => edge.target === componentNode.id).flatMap((edge, index) => {
      const port = inputById.get(String(edge.targetHandle || ''));
      const target = port ? idMap.get(port.internal_node_id) : undefined;
      if (!port || !target) return [];
      return [{ ...edge, id: `${edge.id}__expanded-in__${nonce}-${index}`, target, targetHandle: port.internal_handle, animated: true }];
    });
    const outgoingEdges = edges.filter((edge) => edge.source === componentNode.id).flatMap((edge, index) => {
      const port = outputById.get(String(edge.sourceHandle || ''));
      const source = port ? idMap.get(port.internal_node_id) : undefined;
      if (!port || !source) return [];
      return [{ ...edge, id: `${edge.id}__expanded-out__${nonce}-${index}`, source, sourceHandle: port.internal_handle, animated: true }];
    });

    const expandedIds = expandedNodes.map((node) => node.id);
    setNodes((items) => [...items.filter((node) => node.id !== componentNode.id).map((node) => ({ ...node, selected: false })), ...expandedNodes]);
    setEdges([...outsideEdges, ...expandedEdges, ...incomingEdges, ...outgoingEdges]);
    setSelectedId(expandedIds[0] || null);
    setSelectedIds(expandedIds);
    setSelectedEdgeId(null);
    setSelectedEdgeIds([]);
    setModalNodeId(null);
    setConfirmUngroupComponent(null);
    setMessage(`کامپوننت «${String(componentNode.data?.label || componentNode.data?.typeLabel || '')}» فقط در این جریان به نودهای اصلی بازگردانده شد. نسخه کتابخانه بدون تغییر باقی ماند.`);
    window.setTimeout(() => fitView({ nodes: expandedNodes, padding: 0.2, duration: 300 }), 40);
  }, [componentEditor, edges, fitView, versionPreview]);

  const saveComponentVersion = useCallback(async (semanticVersion: string, changelog: string) => {
    if (!componentEditor) return;
    setComponentBusy(true);
    try {
      const version = await api.createComponentVersion(componentEditor.component.id, {
        semantic_version: semanticVersion,
        graph: { nodes, edges, meta: {} },
        interface: componentEditor.version.interface_json,
        exposed_parameters: componentEditor.version.exposed_parameters,
        changelog,
      });
      const [updatedComponent, registryNode] = await Promise.all([
        api.getComponent(componentEditor.component.id, projectId),
        api.componentRegistry(componentEditor.component.id, projectId),
      ]);
      setComponentEditor((current) => current ? { ...current, component: updatedComponent, version, baselineSignature: componentDraftSignature(nodes, edges, version) } : current);
      setComponentVersionDialogOpen(false);
      await Promise.all([refreshComponents(), refreshRegistry()]);
      if (componentEditor.sourceNodeId) {
        setPendingComponentUpgrade({ component: updatedComponent, version, registryNode });
        setMessage(`نسخه ${version.semantic_version} ذخیره شد. برای ارتقای این نمونه تأیید کنید.`);
      } else {
        setMessage(`نسخه ${version.semantic_version} ذخیره شد. جریان‌های موجود همچنان به نسخه قبلی متصل‌اند.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره نسخه کامپوننت ناموفق بود');
    } finally {
      setComponentBusy(false);
    }
  }, [componentEditor, edges, nodes, projectId, refreshComponents, refreshRegistry]);

  const applyComponentDefinition = useCallback((value: { inputs: ComponentBoundaryPort[]; outputs: ComponentBoundaryPort[]; exposedParameters: ComponentVersion['exposed_parameters'] }) => {
    setComponentEditor((current) => current ? {
      ...current,
      version: {
        ...current.version,
        interface_json: { inputs: value.inputs, outputs: value.outputs },
        exposed_parameters: value.exposedParameters,
      },
    } : current);
    setComponentDefinitionDialogOpen(false);
    setMessage('رابط عمومی و پارامترها برای نسخه جدید آماده شد. برای ثبت، نسخه جدید ذخیره کنید.');
  }, []);

  const confirmUpgradeComponentInstance = useCallback(() => {
    if (!componentEditor?.sourceNodeId || !pendingComponentUpgrade) return;
    const sourceNodeId = componentEditor.sourceNodeId;
    const inputIds = new Set((pendingComponentUpgrade.registryNode.inputs || []).map((port) => port.id));
    const outputIds = new Set((pendingComponentUpgrade.registryNode.outputs || []).map((port) => port.id));
    const missingInputs = componentEditor.parentEdges.filter((edge) => edge.target === sourceNodeId && edge.targetHandle && !inputIds.has(String(edge.targetHandle)));
    const missingOutputs = componentEditor.parentEdges.filter((edge) => edge.source === sourceNodeId && edge.sourceHandle && !outputIds.has(String(edge.sourceHandle)));
    if (missingInputs.length || missingOutputs.length) {
      setMessage('ارتقا انجام نشد: نسخه جدید بعضی پورت‌های متصل این نمونه را ندارد. ابتدا رابط عمومی را سازگار کنید.');
      setPendingComponentUpgrade(null);
      return;
    }
    const existing = componentEditor.parentNodes.find((node) => node.id === sourceNodeId);
    const defaults = Object.fromEntries((pendingComponentUpgrade.registryNode.settingsSchema || []).map((item) => [item.name, item.default]));
    const oldParams = (existing?.data?.params || {}) as Record<string, unknown>;
    const allowed = new Set((pendingComponentUpgrade.registryNode.settingsSchema || []).map((item) => item.name));
    const preserved = Object.fromEntries(Object.entries(oldParams).filter(([key]) => allowed.has(key)));
    const replacementData = {
      ...(existing?.data || {}),
      registryId: pendingComponentUpgrade.registryNode.id,
      catalogId: pendingComponentUpgrade.registryNode.id,
      typeLabel: pendingComponentUpgrade.component.name,
      category: pendingComponentUpgrade.registryNode.category,
      description: pendingComponentUpgrade.registryNode.description,
      inputs: pendingComponentUpgrade.registryNode.inputs,
      outputs: pendingComponentUpgrade.registryNode.outputs,
      params: { ...defaults, ...preserved },
      componentSnapshot: pendingComponentUpgrade.registryNode.template?.componentSnapshot,
      componentId: pendingComponentUpgrade.component.id,
      componentVersionId: pendingComponentUpgrade.version.id,
      componentVersion: pendingComponentUpgrade.version.semantic_version,
    };
    setNodes(componentEditor.parentNodes.map((node) => node.id === sourceNodeId ? { ...node, data: replacementData } : node));
    setEdges(componentEditor.parentEdges);
    setComponentEditor(null);
    setPendingComponentUpgrade(null);
    setSelectedId(sourceNodeId);
    setSelectedIds([sourceNodeId]);
    setMessage(`نمونه کامپوننت به نسخه ${pendingComponentUpgrade.version.semantic_version} ارتقا یافت.`);
    window.setTimeout(() => fitView({ padding: 0.1, duration: 260 }), 40);
  }, [componentEditor, fitView, pendingComponentUpgrade]);

  const exportComponentPackage = useCallback(async (component: WorkflowComponent) => {
    try {
      const payload = await api.exportComponent(component.id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${component.name.replace(/[^a-z0-9_-]+/gi, '-') || 'component'}.iotacomp.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'خروجی کامپوننت ناموفق بود');
    }
  }, []);

  const importComponentPackage = useCallback(async (payload: Record<string, unknown>) => {
    setComponentBusy(true);
    try {
      const component = await api.importComponent(payload);
      await Promise.all([refreshComponents(), refreshRegistry()]);
      setMessage(`کامپوننت «${component.name}» وارد شد.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import کامپوننت ناموفق بود');
    } finally {
      setComponentBusy(false);
    }
  }, [refreshComponents, refreshRegistry]);


  const refreshManagedComponentVersions = useCallback(async (component = managedComponent) => {
    if (!component) return [];
    const versions = await api.componentVersions(component.id, projectId);
    setManagedComponentVersions(versions);
    return versions;
  }, [managedComponent, projectId]);

  const openComponentVersionManager = useCallback(async (component: WorkflowComponent) => {
    setManagedComponent(component);
    setManagedComponentVersions([]);
    setComponentBusy(true);
    try {
      const versions = await api.componentVersions(component.id, projectId);
      setManagedComponentVersions(versions);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'دریافت نسخه‌های کامپوننت ناموفق بود');
      setManagedComponent(null);
    } finally {
      setComponentBusy(false);
    }
  }, [projectId]);

  const openManagedComponentVersion = useCallback(async ({ component, version }: ComponentVersionAction) => {
    setComponentBusy(true);
    try {
      const fullVersion = await api.getComponentVersion(component.id, version.id, projectId);
      setManagedComponent(null);
      await enterComponentEditor(component, fullVersion);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'باز کردن نسخه کامپوننت ناموفق بود');
    } finally {
      setComponentBusy(false);
    }
  }, [enterComponentEditor, projectId]);

  const makeManagedComponentVersionCurrent = useCallback(async ({ component, version }: ComponentVersionAction) => {
    setComponentBusy(true);
    try {
      const updated = await api.makeComponentVersionCurrent(component.id, version.id);
      setManagedComponent(updated);
      await Promise.all([refreshManagedComponentVersions(updated), refreshComponents(), refreshRegistry()]);
      setMessage(`نسخه ${version.semantic_version} به‌عنوان نسخه جاری کامپوننت انتخاب شد. نمونه‌های موجود بدون تغییر باقی ماندند.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'انتخاب نسخه جاری ناموفق بود');
    } finally {
      setComponentBusy(false);
    }
  }, [refreshComponents, refreshManagedComponentVersions, refreshRegistry]);

  const exportManagedComponentVersion = useCallback(async ({ component, version }: ComponentVersionAction) => {
    try {
      const payload = await api.exportComponent(component.id, version.id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${component.name.replace(/[^a-z0-9_-]+/gi, '-') || 'component'}-v${version.semantic_version}.iotacomp.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'خروجی نسخه کامپوننت ناموفق بود');
    }
  }, []);

  useEffect(() => {
    if (!analysisBoards.some((tab) => tab.id === activeBoardId)) setActiveBoardId(MAIN_ANALYSIS_BOARD_ID);
    if (!analysisBoards.some((tab) => tab.id === boardTargetId)) setBoardTargetId(MAIN_ANALYSIS_BOARD_ID);
  }, [analysisBoards, activeBoardId, boardTargetId]);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((items) => applyNodeChanges(changes, items)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((items) => applyEdgeChanges(changes, items)), []);
  const onInputSourceHandleChange = useCallback((edgeId: string, sourceHandle: string) => {
    if (versionPreview) return;
    setEdges((items) => items.map((edge) => edge.id === edgeId ? { ...edge, sourceHandle } : edge));
  }, [versionPreview]);
  const onConnect = useCallback((connection: Connection) => {
    if (versionPreview) return;
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);
    const sourcePorts = (sourceNode?.data?.outputs || []) as Array<{ id?: string }>;
    const targetPorts = (targetNode?.data?.inputs || []) as Array<{ id?: string }>;
    const sourceHandle = connection.sourceHandle || String(sourcePorts[0]?.id || 'output');
    const targetHandle = connection.targetHandle || String(targetPorts[0]?.id || 'input');
    const sourceType = portTypeFor(sourceNode, registry, catalog.aliases, sourceHandle, 'source');
    const targetType = portTypeFor(targetNode, registry, catalog.aliases, targetHandle, 'target');
    if (!compatiblePorts(sourceType, targetType, catalog.compatiblePorts)) {
      setMessage(`اتصال نامعتبر است: ${sourceType} → ${targetType}`);
      return;
    }
    setEdges((items) => addEdge({ ...connection, sourceHandle, targetHandle, animated: true }, items));
  }, [nodes, registry, catalog.aliases, catalog.compatiblePorts, versionPreview]);

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
    if (versionPreview) return;
    if (node.data?.componentSnapshot) {
      void enterComponentNode(node);
      return;
    }
    setSelectedId((previous) => (previous === node.id ? previous : node.id));
    setSelectedIds((previous) => (sameStringArray(previous, [node.id]) ? previous : [node.id]));
    setModalNodeId(node.id);
  }, [enterComponentNode, versionPreview]);

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
    if (versionPreview) return;
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
  }, [selectedId, selectedIds, selectedEdgeId, selectedEdgeIds, versionPreview]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if ((event.key === 'Delete' || event.key === 'Backspace') && !isTextInput(event.target)) deleteSelected(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected]);

  const updateNodeParams = useCallback((nodeId: string, params: Record<string, unknown>) => {
    if (versionPreview) return;
    setNodes((items) => items.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, params } } : node)));
  }, [versionPreview]);

  const renameNode = useCallback((nodeId: string, label: string) => {
    if (versionPreview) return;
    setNodes((items) => items.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, label } } : node)));
    setAnalysisBoards((tabs) => tabs.map((tab) => ({
      ...tab,
      items: tab.items.map((item) => item.nodeId === nodeId ? { ...item, sourceLabel: label } : item),
    })));
  }, [versionPreview]);

  const updateNodePinned = useCallback((nodeId: string, pinned: PinnedNodeData) => {
    if (versionPreview) return;
    setNodes((items) => items.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, pinned } } : node)));
  }, [versionPreview]);

  const selectWorkflowNode = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
    setSelectedIds([nodeId]);
    setSelectedEdgeId(null);
    setSelectedEdgeIds([]);
    setResultsCollapsed(false);
  }, [versionPreview]);

  const updateBoardItems = useCallback((boardId: string, updater: (items: AnalysisBoardItem[]) => AnalysisBoardItem[]) => {
    setAnalysisBoards((tabs) => tabs.map((tab) => tab.id === boardId ? { ...tab, items: updater(tab.items) } : tab));
  }, []);

  const addOutputToBoard = useCallback((output: Output, visibleIndex: number, destinationBoardId: string) => {
    if (versionPreview) return;
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
  }, [allRunOutputs, analysisBoards, currentRun?.id, nodes, selectedId, updateBoardItems, versionPreview]);

  const addOutputToMainBoard = useCallback((output: Output, visibleIndex: number) => {
    addOutputToBoard(output, visibleIndex, MAIN_ANALYSIS_BOARD_ID);
  }, [addOutputToBoard]);

  const addOutputFromRightPanel = useCallback((output: Output, visibleIndex: number) => {
    addOutputToBoard(output, visibleIndex, analysisBoardOpen ? boardTargetId : MAIN_ANALYSIS_BOARD_ID);
  }, [addOutputToBoard, analysisBoardOpen, boardTargetId]);

  const createAnalysisBoard = useCallback(() => {
    if (versionPreview) return;
    const id = `analysis-board-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setAnalysisBoards((tabs) => [...tabs, { id, name: `برد ${tabs.length + 1}`, items: [], viewport: { x: 0, y: 0, scale: 1 }, createdAt: new Date().toISOString() }]);
    setActiveBoardId(id);
    setBoardTargetId(id);
  }, [versionPreview]);

  const updateBoardViewport = useCallback((boardId: string, viewport: BoardViewport) => {
    if (versionPreview) return;
    setAnalysisBoards((tabs) => tabs.map((tab) => {
      if (tab.id !== boardId) return tab;
      const current = tab.viewport || { x: 0, y: 0, scale: 1 };
      if (Math.abs(current.x - viewport.x) < 0.01 && Math.abs(current.y - viewport.y) < 0.01 && Math.abs(current.scale - viewport.scale) < 0.0001) return tab;
      return { ...tab, viewport };
    }));
  }, [versionPreview]);

  const renameAnalysisBoard = useCallback((id: string, name: string) => {
    if (versionPreview) return;
    const normalized = name.trim();
    if (!normalized) return;
    setAnalysisBoards((tabs) => tabs.map((tab) => tab.id === id ? { ...tab, name: normalized } : tab));
  }, [versionPreview]);

  const removeAnalysisBoard = useCallback((id: string) => {
    if (versionPreview) return;
    if (id === MAIN_ANALYSIS_BOARD_ID) return;
    setAnalysisBoards((tabs) => tabs.filter((tab) => tab.id !== id));
    setActiveBoardId(MAIN_ANALYSIS_BOARD_ID);
    setBoardTargetId(MAIN_ANALYSIS_BOARD_ID);
  }, [versionPreview]);

  const openRenameActiveBoard = useCallback(() => {
    if (!activeBoard || versionPreview) return;
    setRenameBoardDraft(activeBoard.name);
    setRenameBoardDialogOpen(true);
  }, [activeBoard, versionPreview]);

  const confirmRenameActiveBoard = useCallback(() => {
    if (!activeBoard) return;
    const name = renameBoardDraft.trim();
    if (!name) return;
    renameAnalysisBoard(activeBoard.id, name);
    setRenameBoardDialogOpen(false);
  }, [activeBoard, renameAnalysisBoard, renameBoardDraft]);

  const confirmDeleteActiveBoard = useCallback(() => {
    if (!activeBoard || activeBoard.id === MAIN_ANALYSIS_BOARD_ID) return;
    removeAnalysisBoard(activeBoard.id);
    setDeleteBoardDialogOpen(false);
  }, [activeBoard, removeAnalysisBoard]);

  const updateBoardItem = useCallback((id: string, patch: Partial<AnalysisBoardItem>) => {
    if (versionPreview) return;
    updateBoardItems(activeBoardId, (items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }, [activeBoardId, updateBoardItems, versionPreview]);

  const removeBoardItem = useCallback((id: string) => {
    if (versionPreview) return;
    updateBoardItems(activeBoardId, (items) => items.filter((item) => item.id !== id));
  }, [activeBoardId, updateBoardItems, versionPreview]);

  const duplicateBoardItem = useCallback((item: AnalysisBoardItem) => {
    if (versionPreview) return;
    updateBoardItems(activeBoardId, (items) => [...items, {
      ...item,
      id: `board-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      x: item.x + 26,
      y: item.y + 26,
      createdAt: new Date().toISOString(),
    }]);
  }, [activeBoardId, updateBoardItems, versionPreview]);

  const clearActiveBoard = useCallback(() => {
    if (versionPreview) return;
    updateBoardItems(activeBoardId, () => []);
  }, [activeBoardId, updateBoardItems, versionPreview]);

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
    if (versionPreview) return;
    const nodeId = event.dataTransfer.getData('application/nocodeml-node');
    const registryNode = registry.find((node) => node.id === nodeId);
    if (!registryNode) return;
    const newNode = makeNode(registryNode, nodes.length, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    setNodes((items) => [...items, newNode]); setSelectedId(newNode.id); setSelectedEdgeId(null);
  }, [nodes.length, registry, screenToFlowPosition, versionPreview]);

  const prettyLayout = () => {
    if (versionPreview) return;
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

  const serializedAnalysisBoards = useMemo(
    () => serializeAnalysisBoardTabs(analysisBoards),
    [analysisBoards],
  );

  const analysisBoardSignature = useMemo(() => analysisBoards.map((tab) => ({
    id: tab.id,
    name: tab.name,
    viewport: tab.viewport,
    createdAt: tab.createdAt,
    items: tab.items.map((item) => ({
      id: item.id,
      nodeId: item.nodeId,
      outputIndex: item.outputIndex,
      outputTitle: item.outputTitle,
      outputKind: item.outputKind,
      sourceLabel: item.sourceLabel,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      runId: item.runId,
      createdAt: item.createdAt,
      snapshotKind: item.snapshot?.kind,
      snapshotTitle: item.snapshot?.title,
    })),
  })), [analysisBoards]);

  const currentGraph = useMemo<FlowGraph>(() => {
    return {
      nodes,
      edges: normalizeEdgeHandles(nodes, edges),
      meta: {
        datasetId,
        targetColumn,
        taskType,
        analysisBoard: serializedAnalysisBoards.find((tab) => tab.id === MAIN_ANALYSIS_BOARD_ID)?.items || [],
        analysisBoards: serializedAnalysisBoards,
        activeAnalysisBoardId: activeBoardId,
      },
    };
  }, [activeBoardId, datasetId, edges, nodes, serializedAnalysisBoards, targetColumn, taskType]);

  const graphPayload = () => currentGraph;

  const autosaveSnapshot = useMemo(() => ({
    name: workflowName.trim(),
    graph: currentGraph as unknown as Record<string, unknown>,
    project_id: projectId,
    last_run_id: workflowLastRunId,
  }), [currentGraph, projectId, workflowLastRunId, workflowName]);
  const autosaveSignature = useMemo(() => JSON.stringify({
    name: workflowName.trim(),
    projectId,
    workflowLastRunId,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      data: edge.data,
    })),
    datasetId,
    targetColumn,
    taskType,
    activeBoardId,
    analysisBoards: analysisBoardSignature,
  }), [activeBoardId, analysisBoardSignature, datasetId, edges, nodes, projectId, targetColumn, taskType, workflowLastRunId, workflowName]);

  const persistWorkflowSnapshot = useCallback((
    snapshot: { name: string; graph: Record<string, unknown>; project_id: number; last_run_id: number | null },
    signature: string,
    sessionId = editorSessionRef.current,
  ): Promise<Workflow> => {
    const execute = async (): Promise<Workflow> => {
      if (sessionId !== editorSessionRef.current) throw new Error('AUTOSAVE_SUPERSEDED');
      if (!snapshot.name) throw new Error('نام جریان را وارد کنید');
      setAutosaveState('saving');
      try {
        const workflowId = workflowIdRef.current;
        const saved = workflowId
          ? await api.autosaveWorkflow(workflowId, {
            ...snapshot,
            base_revision: workflowRevisionRef.current,
          })
          : await api.createWorkflow(snapshot);
        if (sessionId !== editorSessionRef.current) return saved;
        workflowIdRef.current = saved.id;
        workflowRevisionRef.current = saved.revision;
        setCurrentWorkflowId(saved.id);
        setWorkflowRevision(saved.revision);
        setAutosaveUpdatedAt(saved.last_autosaved_at || saved.updated_at);
        setAutosaveState('saved');
        lastSavedSignatureRef.current = signature;
        void refreshWorkflows().catch(() => undefined);
        return saved;
      } catch (error) {
        if (sessionId !== editorSessionRef.current || (error instanceof Error && error.message === 'AUTOSAVE_SUPERSEDED')) throw error;
        if (error instanceof ApiError && error.code === 'WORKFLOW_REVISION_CONFLICT') {
          setAutosaveState('conflict');
          setMessage('این جریان در نشست دیگری تغییر کرده است. برای جلوگیری از بازنویسی، جریان را دوباره بارگذاری کنید.');
        } else {
          setAutosaveState('error');
          setMessage(error instanceof Error ? error.message : 'ذخیره خودکار ناموفق بود');
        }
        throw error;
      }
    };

    const queued = autosaveQueueRef.current.catch(() => undefined).then(execute);
    autosaveQueueRef.current = queued.catch(() => undefined);
    return queued;
  }, [refreshWorkflows]);

  useEffect(() => {
    if (versionPreview || componentEditor || !autosaveSnapshot.name) return undefined;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      lastSavedSignatureRef.current = autosaveSignature;
      return undefined;
    }
    if (autosaveSignature === lastSavedSignatureRef.current) return undefined;
    setAutosaveState((state) => state === 'saving' ? state : 'idle');
    const sessionId = editorSessionRef.current;
    const timer = window.setTimeout(() => {
      void persistWorkflowSnapshot(autosaveSnapshot, autosaveSignature, sessionId).catch((error) => {
        if (error instanceof Error && error.message === 'AUTOSAVE_SUPERSEDED') return;
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [autosaveSignature, autosaveSnapshot, componentEditor, persistWorkflowSnapshot, versionPreview]);

  const exportCurrentWorkflow = () => {
    exportWorkflowJson(workflowName, graphPayload());
    setMessage('فایل JSON جریان دانلود شد');
  };

  const saveWorkflowVersion = async (versionName: string, description: string) => {
    if (versionPreview) {
      setMessage('ابتدا نسخه انتخاب‌شده را بازیابی کنید یا به آخرین نسخه خودکار برگردید.');
      return;
    }
    if (!workflowName.trim()) {
      setMessage('نام جریان را وارد کنید');
      return;
    }
    setVersionBusy(true);
    try {
      const saved = await persistWorkflowSnapshot(autosaveSnapshot, autosaveSignature);
      const version = await api.createWorkflowVersion(saved.id, {
        name: versionName,
        description,
        run_id: workflowLastRunId,
      });
      setSelectedVersionId(version.id);
      await refreshWorkflowVersions(saved.id);
      setWorkflowVersionDialogOpen(false);
      setMessage(`نسخه «${version.name}» ذخیره شد`);
    } catch (error) {
      if (!(error instanceof Error && error.message === 'AUTOSAVE_SUPERSEDED')) {
        setMessage(error instanceof Error ? error.message : 'ذخیره نسخه ناموفق بود');
      }
    } finally {
      setVersionBusy(false);
    }
  };

  const loadWorkflow = async (idValue: string) => {
    const id = Number(idValue) || null;
    if (!id) return;
    try {
      if (!versionPreview && autosaveSnapshot.name) {
        await persistWorkflowSnapshot(autosaveSnapshot, autosaveSignature).catch((error) => {
          if (error instanceof ApiError && error.code === 'WORKFLOW_REVISION_CONFLICT') throw error;
        });
      }
      editorSessionRef.current += 1;
      const workflow = await api.getWorkflow(id);
      const [versions, lastRun] = await Promise.all([
        api.workflowVersions(id),
        workflow.last_run_id ? api.getRun(workflow.last_run_id).catch(() => null) : Promise.resolve(null),
      ]);
      workflowIdRef.current = workflow.id;
      workflowRevisionRef.current = workflow.revision;
      setCurrentWorkflowId(workflow.id);
      setWorkflowRevision(workflow.revision);
      setWorkflowName(workflow.name);
      setWorkflowVersions(versions);
      setVersionPreview(null);
      setSelectedVersionId(null);
      applyGraphToEditor(workflow.graph as unknown as FlowGraph, registry, catalog.aliases);
      setCurrentRun(lastRun);
      setWorkflowLastRunId(workflow.last_run_id ?? null);
      setAutosaveUpdatedAt(workflow.last_autosaved_at || workflow.updated_at);
      setAutosaveState('saved');
      setLastRunSignature('');
      lastSavedSignatureRef.current = '';
      skipNextAutosaveRef.current = true;
      setMessage('جریان بارگذاری شد');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'بارگذاری ناموفق بود');
    }
  };

  const viewWorkflowVersion = useCallback(async (versionSummary: WorkflowVersionSummary) => {
    const workflowId = workflowIdRef.current;
    if (!workflowId) return;
    setVersionBusy(true);
    try {
      if (!versionPreview && autosaveSnapshot.name) {
        await persistWorkflowSnapshot(autosaveSnapshot, autosaveSignature);
      }
      const version = await api.getWorkflowVersion(workflowId, versionSummary.id);
      const attachedRun = version.run_id ? await api.getRun(version.run_id).catch(() => null) : null;
      setVersionPreview(version);
      setSelectedVersionId(version.id);
      applyGraphToEditor(version.graph as unknown as FlowGraph, registry, catalog.aliases);
      setCurrentRun(attachedRun);
      setLastRunSignature('');
      setMessage(`نسخه «${version.name}» فقط برای مشاهده باز شد`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'دریافت نسخه ناموفق بود');
    } finally {
      setVersionBusy(false);
    }
  }, [applyGraphToEditor, autosaveSignature, autosaveSnapshot, catalog.aliases, persistWorkflowSnapshot, registry, versionPreview]);

  const returnToCurrentVersion = useCallback(async () => {
    const workflowId = workflowIdRef.current;
    if (!workflowId) return;
    setVersionBusy(true);
    try {
      const workflow = await api.getWorkflow(workflowId);
      const attachedRun = workflow.last_run_id ? await api.getRun(workflow.last_run_id).catch(() => null) : null;
      workflowRevisionRef.current = workflow.revision;
      setWorkflowRevision(workflow.revision);
      setWorkflowName(workflow.name);
      setVersionPreview(null);
      setSelectedVersionId(null);
      applyGraphToEditor(workflow.graph as unknown as FlowGraph, registry, catalog.aliases);
      setCurrentRun(attachedRun);
      setWorkflowLastRunId(workflow.last_run_id ?? null);
      setAutosaveUpdatedAt(workflow.last_autosaved_at || workflow.updated_at);
      setAutosaveState('saved');
      lastSavedSignatureRef.current = '';
      skipNextAutosaveRef.current = true;
      setMessage('آخرین نسخه خودکار نمایش داده شد');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'بازگشت به نسخه جاری ناموفق بود');
    } finally {
      setVersionBusy(false);
    }
  }, [applyGraphToEditor, catalog.aliases, registry]);

  const restoreWorkflowVersion = useCallback(async (version: WorkflowVersionSummary) => {
    const workflowId = workflowIdRef.current;
    if (!workflowId || !window.confirm(`نسخه «${version.name}» جایگزین پیش‌نویس جاری شود؟`)) return;
    setVersionBusy(true);
    try {
      const workflow = await api.restoreWorkflowVersion(workflowId, version.id);
      const attachedRun = workflow.last_run_id ? await api.getRun(workflow.last_run_id).catch(() => null) : null;
      workflowRevisionRef.current = workflow.revision;
      setWorkflowRevision(workflow.revision);
      setWorkflowName(workflow.name);
      setVersionPreview(null);
      setSelectedVersionId(null);
      applyGraphToEditor(workflow.graph as unknown as FlowGraph, registry, catalog.aliases);
      setCurrentRun(attachedRun);
      setWorkflowLastRunId(workflow.last_run_id ?? null);
      setAutosaveUpdatedAt(workflow.last_autosaved_at || workflow.updated_at);
      setAutosaveState('saved');
      lastSavedSignatureRef.current = '';
      skipNextAutosaveRef.current = true;
      await Promise.all([refreshWorkflowVersions(workflowId), refreshWorkflows()]);
      setMessage(`نسخه «${version.name}» بازیابی شد`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'بازیابی نسخه ناموفق بود');
    } finally {
      setVersionBusy(false);
    }
  }, [applyGraphToEditor, catalog.aliases, refreshWorkflowVersions, refreshWorkflows, registry]);

  const deleteWorkflowVersion = useCallback(async (version: WorkflowVersionSummary) => {
    const workflowId = workflowIdRef.current;
    if (!workflowId || !window.confirm(`نسخه «${version.name}» حذف شود؟`)) return;
    setVersionBusy(true);
    try {
      await api.deleteWorkflowVersion(workflowId, version.id);
      if (versionPreview?.id === version.id) {
        const workflow = await api.getWorkflow(workflowId);
        const attachedRun = workflow.last_run_id ? await api.getRun(workflow.last_run_id).catch(() => null) : null;
        workflowRevisionRef.current = workflow.revision;
        setWorkflowRevision(workflow.revision);
        setVersionPreview(null);
        setSelectedVersionId(null);
        applyGraphToEditor(workflow.graph as unknown as FlowGraph, registry, catalog.aliases);
        setCurrentRun(attachedRun);
        setWorkflowLastRunId(workflow.last_run_id ?? null);
        lastSavedSignatureRef.current = '';
        skipNextAutosaveRef.current = true;
      }
      await refreshWorkflowVersions(workflowId);
      setMessage('نسخه حذف شد');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'حذف نسخه ناموفق بود');
    } finally {
      setVersionBusy(false);
    }
  }, [applyGraphToEditor, catalog.aliases, refreshWorkflowVersions, registry, versionPreview?.id]);

  const runGraphFromNode = async (nodeId: string | null) => {
    if (versionPreview) {
      setMessage('برای اجرا، نسخه ذخیره‌شده را بازیابی کنید یا به آخرین نسخه خودکار برگردید.');
      return;
    }
    const normalizedEdges = normalizeEdgeHandles(nodes, edges);
    const graphToRun = connectedGraph(nodes, normalizedEdges, nodeId);
    if (nodeId) {
      setSelectedId(nodeId);
      setSelectedIds([nodeId]);
      setSelectedEdgeId(null);
      setSelectedEdgeIds([]);
    }
    setMessage('در حال تثبیت آخرین تغییرات جریان…');
    try {
      const savedWorkflow = await persistWorkflowSnapshot(autosaveSnapshot, autosaveSignature);
      setBusy(true);
      setMessage(graphToRun.mode === 'selected' ? 'جریان متصل به نود انتخاب‌شده اجرا می‌شود' : 'کل برد اجرا می‌شود');
      const graph = { nodes: graphToRun.nodes, edges: graphToRun.edges, meta: { datasetId, targetColumn, taskType } };
      const run = await api.createRun({
        workflow_name: workflowName,
        workflow_graph: graph,
        workflow_id: savedWorkflow.id,
        workflow_revision: savedWorkflow.revision,
        bypass_cache: false,
        dataset_id: datasetId,
        project_id: projectId,
        target_column: targetColumn,
        task_type: taskType || 'auto',
        idempotency_key: crypto.randomUUID(),
      });
      setCurrentRun(run);
      setRunHistory((items) => upsertRunSummary(items, run));
      setLastRunSignature(currentOutputSignature);
      setMessage('جریان در صف اجرا قرار گرفت');
    } catch (error) {
      if (!(error instanceof Error && error.message === 'AUTOSAVE_SUPERSEDED')) {
        setMessage(error instanceof Error ? error.message : 'اجرا ناموفق بود');
      }
      setBusy(false);
    }
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
          if (completed.status === 'succeeded') setWorkflowLastRunId(completed.id);
          setRunHistory((items) => upsertRunSummary(items, completed));
          setBusy(false);
          void refreshRunHistory();
          return;
        }

        setCurrentRun((run) => run && run.id === runId ? mergeRunProgress(run, snapshot) : run);
        timer = window.setTimeout(poll, snapshot.status === 'queued' ? 900 : 650);
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : 'دریافت وضعیت اجرا ناموفق بود');
        timer = window.setTimeout(poll, 1500);
      }
    };

    timer = window.setTimeout(poll, 120);
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
    ['--workflow-results-width' as string]: `${resultsWidth}px`,
    ['--workflow-left-panel-offset' as string]: paletteCollapsed ? '76px' : '304px'
  };
  const flowNodes = useMemo(() => nodes.map((node) => {
    const runtimeInfo = currentRun?.node_statuses?.[node.id];
    return {
      ...node,
      data: {
        ...node.data,
        onRename: renameNode,
        runtimeStatus: runtimeInfo?.status || null,
        runtimeInfo: runtimeInfo || null,
      },
    };
  }), [currentRun?.node_statuses, nodes, renameNode]);
  const autosaveLabel = versionPreview
    ? `نسخه v${versionPreview.version_number}`
    : autosaveState === 'saving'
      ? 'در حال ذخیره…'
      : autosaveState === 'conflict'
        ? 'تداخل ذخیره'
        : autosaveState === 'error'
          ? 'خطای ذخیره'
          : autosaveState === 'idle'
            ? 'تغییرات ذخیره‌نشده'
            : `ذخیره خودکار · r${workflowRevision}`;


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
          <button className="icon-button icon-only topbar-danger-action" type="button" onClick={onLogout} title="خروج" aria-label="خروج"><LogOut size={17}/></button>
          <button className="icon-button icon-only" type="button" onClick={onProfile} title="پروفایل" aria-label="پروفایل"><UserCircle size={17}/></button>
          <ThemeToggle />
          <button className="icon-button icon-only" type="button" onClick={onProjects} title="پنل پروژه‌ها" aria-label="پنل پروژه‌ها"><LayoutDashboard size={17}/></button>
          {currentRun && !terminalRunStatuses.has(currentRun.status) && <button className="icon-button icon-only topbar-danger-action" type="button" onClick={() => cancelRun(currentRun)} title="توقف اجرا" aria-label="توقف اجرا"><Square size={13} /></button>}
          <button className="icon-button icon-only" type="button" onClick={exportCurrentWorkflow} title="Export workflow JSON" aria-label="Export workflow JSON"><Download size={17}/></button>
          <button className="icon-button icon-only" type="button" disabled={Boolean(versionPreview)} onClick={prettyLayout} title="چیدمان خودکار" aria-label="چیدمان خودکار"><LayoutGrid size={17}/></button>
          <button className="icon-button icon-only" type="button" disabled={Boolean(versionPreview) || Boolean(componentEditor) || selectedIds.length < 2} onClick={openCreateComponent} title="تبدیل نودهای انتخاب‌شده به کامپوننت" aria-label="ساخت کامپوننت"><Layers3 size={17}/></button>
        </div>

        <div className="workflow-topbar-center" style={topbarCenterStyle}>
          <button className="icon-button icon-only topbar-primary-action" title={selectedNode ? 'اجرای مسیر نود انتخاب‌شده' : 'اجرای برد'} aria-label="اجرا" disabled={busy || versionBusy || Boolean(versionPreview) || Boolean(componentEditor) || nodes.length === 0} onClick={runWorkflow}>{busy ? <RefreshCw size={17}className="spin" /> : <Play size={17}/>}</button>
          <button className={`icon-button icon-only ${analysisBoardOpen ? 'active' : ''}`} type="button" onClick={() => setAnalysisBoardOpen((value) => !value)} title={analysisBoardOpen ? 'بازگشت به Workflow' : 'Analysis Board'} aria-label={analysisBoardOpen ? 'بازگشت به Workflow' : 'Analysis Board'}><KanbanSquare size={17}/></button>
          <button className="icon-button icon-only topbar-primary-action" type="button" disabled={versionBusy || Boolean(versionPreview) || Boolean(componentEditor)} onClick={() => setWorkflowVersionDialogOpen(true)} title="ذخیره نسخه نام‌گذاری‌شده" aria-label="ذخیره نسخه نام‌گذاری‌شده">{versionBusy ? <RefreshCw size={17} className="spin" /> : <Save size={17}/>}</button>
          {analysisBoardOpen && <button className="icon-button icon-only" type="button" disabled={Boolean(versionPreview)} onClick={openRenameActiveBoard} title="تغییر نام برد فعال" aria-label="تغییر نام برد فعال"><Pencil size={17}/></button>}
          {analysisBoardOpen && <button className="icon-button icon-only topbar-danger-action" type="button" disabled={Boolean(versionPreview) || activeBoard?.id === MAIN_ANALYSIS_BOARD_ID} onClick={() => setDeleteBoardDialogOpen(true)} title={activeBoard?.id === MAIN_ANALYSIS_BOARD_ID ? 'برد اصلی قابل حذف نیست' : 'حذف برد فعال'} aria-label="حذف برد فعال"><Trash2 size={17}/></button>}
        </div>

        <div className="workflow-topbar-right" style={topbarRightStyle}>
          <span className={`workflow-autosave-status ${autosaveState} ${versionPreview ? 'preview' : ''}`} title={autosaveUpdatedAt ? `آخرین ذخیره: ${new Date(autosaveUpdatedAt).toLocaleString('fa-IR')}` : autosaveLabel}>{autosaveLabel}</span>
          <div className="workflow-breadcrumb workflow-logo-breadcrumb" dir="rtl">
            <div className="workflow-logo-title">
              <img src="/iota.png" alt="IOTA" />
              <h2>IOTA ML</h2>
            </div>
            <h1>›</h1>
            <button type="button" className="workflow-project-link" onClick={onBack} title="بازگشت به صفحه پروژه">{project.name}</button>
            <h1>›</h1>
            <span className="workflow-current-name" title={workflowName}>{workflowName}</span>
          </div>
        </div>
      </header>

      {componentEditor && (
        <div className="component-editor-banner workflow-shell-card" dir="rtl">
          <div className="component-editor-breadcrumb"><Layers3 size={17}/><span>{workflowName}</span><b>›</b><strong>{componentEditor.component.name}</strong><small>v{componentEditor.version.semantic_version}{componentEditorDirty ? " · تغییر ذخیره‌نشده" : ""}</small></div>
          <div className="component-editor-actions">
            <button type="button" className="secondary-button compact" disabled={componentBusy} onClick={() => setComponentDefinitionDialogOpen(true)}><SlidersHorizontal size={15}/> پورت‌ها و پارامترها</button>
            <button type="button" className="secondary-button compact" onClick={requestLeaveComponentEditor}><ArrowLeft size={15}/> بازگشت به جریان</button>
            <button type="button" className="primary-button compact" disabled={componentBusy} onClick={() => setComponentVersionDialogOpen(true)}><Save size={15}/> ذخیره نسخه جدید</button>
          </div>
        </div>
      )}

      <main className={`workspace ${paletteCollapsed ? 'palette-collapsed' : ''} ${resultsCollapsed ? 'results-collapsed' : ''} ${componentEditor ? 'component-editor-active' : ''}`} style={floatingWorkspaceStyle}>
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
            <ReactFlow nodes={flowNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onSelectionChange={onSelectionChange} onNodeClick={onNodeClick} onNodeDoubleClick={onNodeDoubleClick} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick} nodesDraggable={!versionPreview && !ctrlSelectionActive} nodesConnectable={!versionPreview} edgesReconnectable={!versionPreview} selectionOnDrag={ctrlSelectionActive} selectionKeyCode={null} multiSelectionKeyCode={multiSelectionKeys} panOnDrag={!ctrlSelectionActive} className={ctrlSelectionActive ? 'workflow-ctrl-selection-active' : ''} onlyRenderVisibleElements fitView>
              <Controls /><MiniMap className="workflow-minimap-visible" pannable zoomable style={{ left: paletteCollapsed ? 76 : 304, right: 'auto', bottom: 24 }} />
            </ReactFlow>
          </div>
          <div className={`analysis-board-mount-layer ${analysisBoardOpen ? '' : 'is-hidden'}`}>
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
              onAddOutput={(output, index) => addOutputToBoard(output, index, activeBoardId)}
              onUpdateItem={updateBoardItem}
              onRemoveItem={removeBoardItem}
              onDuplicateItem={duplicateBoardItem}
              onClear={clearActiveBoard}
              onViewportChange={updateBoardViewport}
              readOnly={Boolean(versionPreview)}
            />
          </div>
        </section>
        <RightPanel
          floatingRightStyle={floatingRightStyle}
          resultsCollapsed={resultsCollapsed}
          setResultsCollapsed={setResultsCollapsed}
          startResize={startResize}
          selectedFlow={selectedFlow}
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
          availableRows={availableRows}
          updateNodeParams={updateNodeParams}
          renameNode={renameNode}
          deleteSelected={deleteSelected}
          onUngroupComponent={(node) => setConfirmUngroupComponent(node)}
          selectedId={selectedId}
          onAddOutputToBoard={addOutputFromRightPanel}
          analysisBoardOpen={analysisBoardOpen}
          boardTabs={analysisBoards}
          boardTargetId={analysisBoardOpen ? boardTargetId : MAIN_ANALYSIS_BOARD_ID}
          onBoardTargetChange={(id) => { setBoardTargetId(id); setActiveBoardId(id); }}
          workflowId={currentWorkflowId}
          workflowVersions={workflowVersions}
          selectedVersionId={selectedVersionId}
          versionPreviewActive={Boolean(versionPreview)}
          onSelectVersion={(version) => { void viewWorkflowVersion(version); }}
          onRestoreVersion={(version) => { void restoreWorkflowVersion(version); }}
          onDeleteVersion={(version) => { void deleteWorkflowVersion(version); }}
          onRefreshVersions={() => { void refreshWorkflowVersions().catch((error) => setMessage(error instanceof Error ? error.message : 'دریافت نسخه‌ها ناموفق بود')); }}
          onReturnToCurrentVersion={() => { void returnToCurrentVersion(); }}
          components={components}
          onRefreshComponents={() => { void refreshComponents().catch((error) => setMessage(error instanceof Error ? error.message : 'دریافت کامپوننت‌ها ناموفق بود')); }}
          onEditComponent={(component) => { if (component.current_version) void enterComponentEditor(component, component.current_version); }}
          onManageComponentVersions={(component) => { void openComponentVersionManager(component); }}
          onExportComponent={(component) => { void exportComponentPackage(component); }}
          onArchiveComponent={(component) => { void api.updateComponent(component.id, { archived: !component.archived }).then(() => refreshComponents()).catch((error) => setMessage(error instanceof Error ? error.message : 'آرشیو کامپوننت ناموفق بود')); }}
          onDeleteComponent={(component) => setConfirmDeleteComponent(component)}
          onImportComponent={(payload) => { void importComponentPackage(payload); }}
          readOnly={Boolean(versionPreview)}
        />
      </main>
      {modalNode && !versionPreview && <NodeModal node={modalNode} workflowNodes={nodes} edges={edges} registry={registry} aliases={catalog.aliases} portCompatibility={catalog.compatiblePorts} datasets={datasets} availableColumns={availableColumns} availableRows={availableRows} run={currentRun} busy={busy} onRunNode={() => runGraphFromNode(modalNode.id)} onParamsChange={updateNodeParams} onRename={renameNode} onPinnedChange={updateNodePinned} onAddOutputToBoard={addOutputToMainBoard} onInputSourceHandleChange={onInputSourceHandleChange} onClose={() => setModalNodeId(null)} />}
      {customBuilderOpen && <CustomNodeBuilder definition={customBuilderDefinition} workflowNodes={nodes} registry={registry} busy={customBuilderBusy} onSave={saveCustomNode} onDelete={customBuilderDefinition ? deleteCustomNode : undefined} onClose={() => { if (!customBuilderBusy) { setCustomBuilderOpen(false); setCustomBuilderDefinition(null); } }} />}
      <AppDialog open={renameBoardDialogOpen} title="تغییر نام برد" description="نام برد فعال را تغییر دهید. محتوا و چیدمان برد بدون تغییر می‌ماند." onClose={() => setRenameBoardDialogOpen(false)} width={440} footer={<>
        <button type="button" className="secondary-button" onClick={() => setRenameBoardDialogOpen(false)}>انصراف</button>
        <button type="button" className="primary-button" disabled={!renameBoardDraft.trim()} onClick={confirmRenameActiveBoard}>ذخیره نام</button>
      </>}>
        <label className="app-dialog-field"><span>نام برد</span><input autoFocus value={renameBoardDraft} maxLength={120} onChange={(event) => setRenameBoardDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && renameBoardDraft.trim()) confirmRenameActiveBoard(); }} /></label>
      </AppDialog>
      <ConfirmDialog open={deleteBoardDialogOpen} title="حذف برد" message={activeBoard ? `برد «${activeBoard.name}» و چیدمان کارت‌های آن حذف شود؟ خروجی‌های اصلی Run حذف نمی‌شوند.` : ''} confirmLabel="حذف برد" danger onClose={() => setDeleteBoardDialogOpen(false)} onConfirm={confirmDeleteActiveBoard} />
      <WorkflowVersionDialog open={workflowVersionDialogOpen} defaultName={`نسخه ${workflowVersions.length + 1}`} busy={versionBusy} onClose={() => setWorkflowVersionDialogOpen(false)} onSave={(name, description) => { void saveWorkflowVersion(name, description); }} />
      <CreateComponentDialog open={createComponentOpen} busy={componentBusy} selectedCount={selectedIds.length} initialInputs={componentBoundary.inputs} initialOutputs={componentBoundary.outputs} onClose={() => setCreateComponentOpen(false)} onCreate={(draft) => { void createComponentFromSelection(draft); }} />
      <ComponentVersionDialog open={componentVersionDialogOpen} busy={componentBusy} currentVersion={componentEditor?.version.semantic_version || '1.0.0'} onClose={() => setComponentVersionDialogOpen(false)} onSave={(semanticVersion, changelog) => { void saveComponentVersion(semanticVersion, changelog); }} />
      <ComponentDefinitionEditorDialog open={componentDefinitionDialogOpen} nodes={nodes} registry={registry} inputs={componentEditor?.version.interface_json.inputs || []} outputs={componentEditor?.version.interface_json.outputs || []} exposedParameters={componentEditor?.version.exposed_parameters || []} onClose={() => setComponentDefinitionDialogOpen(false)} onSave={applyComponentDefinition} />
      <ComponentVersionsDialog open={Boolean(managedComponent)} component={managedComponent} versions={managedComponentVersions} busy={componentBusy} onClose={() => setManagedComponent(null)} onRefresh={() => { void refreshManagedComponentVersions().catch((error) => setMessage(error instanceof Error ? error.message : 'دریافت نسخه‌ها ناموفق بود')); }} onOpenVersion={(action) => { void openManagedComponentVersion(action); }} onMakeCurrent={(action) => { void makeManagedComponentVersionCurrent(action); }} onExportVersion={(action) => { void exportManagedComponentVersion(action); }} onDeleteVersion={(action) => setConfirmDeleteComponentVersion(action)} />
      <ConfirmDialog open={confirmLeaveComponentEditor} title="خروج از ویرایش کامپوننت" message="تغییرات این نسخه هنوز ذخیره نشده‌اند. خروج، تغییرات ویرایشگر کامپوننت را دور می‌ریزد." confirmLabel="خروج بدون ذخیره" danger onClose={() => setConfirmLeaveComponentEditor(false)} onConfirm={leaveComponentEditor} />
      <ConfirmDialog open={Boolean(pendingComponentUpgrade)} title="ارتقای نمونه کامپوننت" message={pendingComponentUpgrade ? `نسخه ${pendingComponentUpgrade.version.semantic_version} ساخته شد. آیا نمونه این کامپوننت در جریان جاری به نسخه جدید ارتقا یابد؟ جریان‌های دیگر بدون تغییر می‌مانند.` : ''} confirmLabel="ارتقای این نمونه" busy={componentBusy} onClose={() => setPendingComponentUpgrade(null)} onConfirm={confirmUpgradeComponentInstance} />
      <ConfirmDialog open={Boolean(confirmDeleteComponentVersion)} title="حذف نسخه کامپوننت" message={confirmDeleteComponentVersion ? `نسخه ${confirmDeleteComponentVersion.version.semantic_version} از «${confirmDeleteComponentVersion.component.name}» حذف شود؟ نسخه جاری یا نسخه‌ای که در جریان‌ها استفاده شده باشد قابل حذف نیست.` : ''} confirmLabel="حذف نسخه" danger busy={componentBusy} onClose={() => setConfirmDeleteComponentVersion(null)} onConfirm={() => { if (!confirmDeleteComponentVersion) return; const action = confirmDeleteComponentVersion; setComponentBusy(true); void api.deleteComponentVersion(action.component.id, action.version.id).then(async () => { setConfirmDeleteComponentVersion(null); await refreshManagedComponentVersions(action.component); setMessage('نسخه کامپوننت حذف شد.'); }).catch((error) => setMessage(error instanceof Error ? error.message : 'حذف نسخه کامپوننت ناموفق بود')).finally(() => setComponentBusy(false)); }} />
      <ConfirmDialog open={Boolean(confirmUngroupComponent)} title="بازگرداندن کامپوننت به نودها" message={confirmUngroupComponent ? `کامپوننت «${String(confirmUngroupComponent.data?.label || confirmUngroupComponent.data?.typeLabel || '')}» در همین جریان به نودهای داخلی تبدیل شود؟ کامپوننت ذخیره‌شده در کتابخانه و استفاده‌های آن در جریان‌های دیگر بدون تغییر می‌ماند.` : ''} confirmLabel="بازگرداندن به نودها" busy={componentBusy} onClose={() => setConfirmUngroupComponent(null)} onConfirm={() => { if (confirmUngroupComponent) ungroupComponentInstance(confirmUngroupComponent); }} />
      <ConfirmDialog open={Boolean(confirmDeleteComponent)} title="حذف کامپوننت" message={confirmDeleteComponent ? `کامپوننت «${confirmDeleteComponent.name}» برای همیشه حذف شود؟ این کار فقط زمانی مجاز است که هیچ جریان یا نسخه‌ای از آن استفاده نکند.` : ''} confirmLabel="حذف کامپوننت" danger busy={componentBusy} onClose={() => setConfirmDeleteComponent(null)} onConfirm={() => { if (!confirmDeleteComponent) return; setComponentBusy(true); void api.deleteComponent(confirmDeleteComponent.id).then(async () => { setConfirmDeleteComponent(null); await Promise.all([refreshComponents(), refreshRegistry()]); setMessage('کامپوننت حذف شد'); }).catch((error) => setMessage(error instanceof Error ? error.message : 'حذف کامپوننت ناموفق بود')).finally(() => setComponentBusy(false)); }} />
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
