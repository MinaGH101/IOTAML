import { useCallback, useEffect, useMemo, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
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
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, History, LayoutDashboard, LayoutGrid, LogOut, MoreHorizontal, Play, PlusCircle, RefreshCw, RotateCcw, Save, Trash2, UserCircle } from 'lucide-react';
import { api } from '../api';
import { CustomSelect } from '../components/CustomSelect';
import { Inspector } from '../components/Inspector';
import { NodeModal } from '../components/NodeModal';
import { NodePalette } from '../components/NodePalette';
import { ResultsPanel } from '../components/ResultsPanel';
import { ThemeToggle } from '../components/ThemeToggle';
import { MlNode } from '../nodes/MlNode';
import type { Dataset, Project, RegistryNode, Run, UserProfile, Workflow } from '../types';
import { formatDateTime, runDuration, sameStringArray } from '../utils/appShared';

const nodeTypes = { mlNode: MlNode };
const multiSelectionKeys = ['Meta', 'Control', 'Shift'];
type PinnedNodeData = { enabled?: boolean; sample?: string };
type FlowGraph = { nodes: Node[]; edges: Edge[]; meta?: { datasetId?: number | null; targetColumn?: string; taskType?: string } };

const DEMO_COLUMNS: Record<string, string[]> = {
  data_demo_iris: ['sepal length (cm)', 'sepal width (cm)', 'petal length (cm)', 'petal width (cm)', 'target'],
  data_demo_wine: ['alcohol', 'malic_acid', 'ash', 'alcalinity_of_ash', 'magnesium', 'total_phenols', 'flavanoids', 'nonflavanoid_phenols', 'proanthocyanins', 'color_intensity', 'hue', 'od280/od315_of_diluted_wines', 'proline', 'target'],
  data_demo_breast_cancer: ['mean radius', 'mean texture', 'mean perimeter', 'mean area', 'mean smoothness', 'mean compactness', 'mean concavity', 'mean concave points', 'mean symmetry', 'mean fractal dimension', 'target']
};

function paramsFromRegistry(node: RegistryNode) {
  return Object.fromEntries(node.params.map((param) => [param.name, param.default]));
}

function makeNode(registryNode: RegistryNode, index: number, position?: { x: number; y: number }): Node {
  return {
    id: `${registryNode.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'mlNode',
    position: position ?? { x: 120 + (index % 4) * 260, y: 100 + Math.floor(index / 4) * 180 },
    data: { registryId: registryNode.id, typeLabel: registryNode.label, label: `Node ${index + 1}`, category: registryNode.category, description: registryNode.description, params: paramsFromRegistry(registryNode) }
  };
}

function normalizeFlowNodes(items: Node[], registry: RegistryNode[]) {
  const byId = Object.fromEntries(registry.map((item) => [item.id, item]));
  const sectionTitles = new Set(['Data Entry', 'Data Transformation', 'Data Analysis & Visualization', 'Model Design & Train', 'Model Analysis', 'ورود داده', 'تبدیل داده', 'تحلیل و نمودار', 'آموزش مدل', 'تحلیل مدل']);
  return items.map((node, index) => {
    const registryId = String(node.data?.registryId || '');
    const registryNode = byId[registryId];
    const storedTypeLabel = String(node.data?.typeLabel || '').trim();
    const typeLabel = !storedTypeLabel || sectionTitles.has(storedTypeLabel) ? String(registryNode?.label || node.data?.label || 'Node Type') : storedTypeLabel;
    const currentLabel = String(node.data?.label || '').trim();
    const label = !currentLabel || currentLabel === typeLabel || sectionTitles.has(currentLabel) ? `Node ${index + 1}` : currentLabel;
    return { ...node, data: { ...node.data, typeLabel, label, category: node.data?.category || registryNode?.category, description: node.data?.description || registryNode?.description } };
  });
}

function defaultGraph(registry: RegistryNode[]): FlowGraph {
  const byId = Object.fromEntries(registry.map((item) => [item.id, item]));
  const ids = ['data_demo_iris', 'data_select_target_features', 'transform_standard_scaler', 'model_random_forest_classifier', 'model_metrics', 'model_feature_importance', 'model_prediction_plot'];
  const positions = [{ x: 80, y: 230 }, { x: 330, y: 230 }, { x: 590, y: 230 }, { x: 850, y: 230 }, { x: 1110, y: 90 }, { x: 1110, y: 240 }, { x: 1110, y: 390 }];
  const nodes = ids.filter((id) => byId[id]).map((id, index) => {
    const node = makeNode(byId[id], index, positions[index]);
    node.id = `${id}-${index}`;
    if (id === 'data_select_target_features') node.data = { ...node.data, params: { target_column: 'target', feature_columns: [], select_all_features: true } };
    return node;
  });
  const edges: Edge[] = [];
  for (let i = 0; i < Math.min(3, nodes.length - 1); i++) edges.push({ id: `e${i}`, source: nodes[i].id, target: nodes[i + 1].id, animated: true });
  if (nodes[3]) {
    [4, 5, 6].forEach((i) => nodes[i] && edges.push({ id: `e${i}`, source: nodes[3].id, target: nodes[i].id, animated: true }));
  }
  return { nodes: normalizeFlowNodes(nodes, registry), edges, meta: { targetColumn: 'target', taskType: 'auto', datasetId: null } };
}

function connectedGraph(allNodes: Node[], allEdges: Edge[], selectedNodeId: string | null) {
  if (!selectedNodeId || !allNodes.some((node) => node.id === selectedNodeId)) return { nodes: allNodes, edges: allEdges, mode: 'all' as const };
  const adjacent = new Map<string, Set<string>>();
  allNodes.forEach((node) => adjacent.set(node.id, new Set()));
  allEdges.forEach((edge) => { adjacent.get(edge.source)?.add(edge.target); adjacent.get(edge.target)?.add(edge.source); });
  const keep = new Set<string>();
  const queue = [selectedNodeId];
  while (queue.length) {
    const current = queue.shift()!;
    if (keep.has(current)) continue;
    keep.add(current);
    adjacent.get(current)?.forEach((next) => !keep.has(next) && queue.push(next));
  }
  return { nodes: allNodes.filter((node) => keep.has(node.id)), edges: allEdges.filter((edge) => keep.has(edge.source) && keep.has(edge.target)), mode: 'selected' as const };
}

function isTextInput(target: EventTarget | null) { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement; }

function upstreamIds(nodes: Node[], edges: Edge[], selectedId: string | null) {
  if (!selectedId) return new Set(nodes.map((n) => n.id));
  const parents = new Map<string, string[]>();
  nodes.forEach((n) => parents.set(n.id, []));
  edges.forEach((e) => parents.get(e.target)?.push(e.source));
  const found = new Set<string>();
  const stack = [selectedId];
  while (stack.length) {
    const id = stack.pop()!;
    if (found.has(id)) continue;
    found.add(id);
    parents.get(id)?.forEach((p) => stack.push(p));
  }
  return found;
}


function RunHistoryPanel({ runs, currentRunId, busy, onSelect, onRetry, onRefresh, compact = false }: { runs: Run[]; currentRunId?: number | null; busy: boolean; onSelect: (run: Run) => void; onRetry: (run: Run) => void; onRefresh: () => void; compact?: boolean }) {
  return (
    <section className={`run-history-panel ${compact ? 'run-history-panel-compact' : ''}`}>
      {!compact && <div className="panel-title run-history-title"><span><History size={13} /> تاریخچه اجرا و Debug</span><button type="button" className="tiny-action" onClick={onRefresh} title="به‌روزرسانی"><RefreshCw size={12} /></button></div>}
      <div className="run-history-list">
        {runs.slice(0, 8).map((run) => (
          <div key={run.id} className={`run-history-row ${currentRunId === run.id ? 'active' : ''}`}>
            <button type="button" className="run-history-main" onClick={() => onSelect(run)}>
              <span className={`run-dot ${run.status}`} />
              <b>{run.workflow_name}</b>
              <small>#{run.id} · {formatDateTime(run.created_at)} · {runDuration(run)}</small>
            </button>
            <button type="button" className="tiny-action" disabled={busy || !run.workflow_graph} onClick={() => onRetry(run)} title="اجرای دوباره با همین گراف"><RotateCcw size={12} /></button>
          </div>
        ))}
        {runs.length === 0 && <div className="empty-state small">هنوز اجرای ذخیره‌شده‌ای برای این پروژه وجود ندارد.</div>}
      </div>
    </section>
  );
}

type WorkflowPageProps = {
  project: Project;
  user: UserProfile;
  initialWorkflowId: number | null;
  onBack: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onProjects: () => void;
};
export function WorkflowPage({ project, user, initialWorkflowId, onBack, onProfile, onLogout, onProjects }: WorkflowPageProps) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const projectId = project.id;
  const [registry, setRegistry] = useState<RegistryNode[]>([]);
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
  const [runHistory, setRunHistory] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [resultsWidth, setResultsWidth] = useState(380);
  const [resultsCollapsed, setResultsCollapsed] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [nodeResultsCollapsed, setNodeResultsCollapsed] = useState(false);

  const refreshWorkflows = useCallback(async () => setWorkflows(await api.workflows(projectId)), [projectId]);
  const refreshRunHistory = useCallback(async () => setRunHistory(await api.listRuns(projectId)), [projectId]);

  useEffect(() => {
    let alive = true;
    Promise.all([api.nodes(), api.datasets(projectId), api.workflows(projectId), api.listRuns(projectId)])
      .then(async ([nodeRegistry, datasetList, workflowList, runList]) => {
        if (!alive) return;
        setRegistry(nodeRegistry);
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
          setNodes(normalizeFlowNodes(graph.nodes || [], nodeRegistry));
          setEdges(graph.edges || []);
          setDatasetId(graph.meta?.datasetId ?? datasetList[0]?.id ?? null);
          setTargetColumn(graph.meta?.targetColumn || 'target');
          setTaskType(graph.meta?.taskType || 'auto');
          setMessage('جریان بارگذاری شد');
          return;
        }

        const graph = defaultGraph(nodeRegistry);
        setNodes(graph.nodes); setEdges(graph.edges);
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
    const ids = upstreamIds(nodes, edges, selectedId);
    const cols: string[] = [];
    nodes.filter((n) => ids.has(n.id)).forEach((node) => {
      const rid = String(node.data.registryId || '');
      if (DEMO_COLUMNS[rid]) cols.push(...DEMO_COLUMNS[rid]);
      if (rid === 'data_csv') {
        const params = (node.data.params || {}) as Record<string, unknown>;
        const dsId = Number(params.dataset_id || datasetId || 0);
        const ds = datasets.find((d) => d.id === dsId);
        if (ds) cols.push(...ds.columns.map((c) => c.name));
      }
    });
    const selectedDataset = datasets.find((d) => d.id === datasetId);
    if (selectedDataset) cols.push(...selectedDataset.columns.map((c) => c.name));
    return [...new Set(cols)];
  }, [nodes, edges, selectedId, datasets, datasetId]);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((items) => applyNodeChanges(changes, items)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((items) => applyEdgeChanges(changes, items)), []);
  const onConnect = useCallback((connection: Connection) => setEdges((items) => addEdge({ ...connection, animated: true }, items)), []);

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
        if (String(node.data.registryId || '') === 'data_csv' && Number(params.dataset_id || 0) === id) {
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

  const graphPayload = (): FlowGraph => ({ nodes, edges, meta: { datasetId, targetColumn, taskType } });

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
      setNodes(normalizeFlowNodes(graph.nodes || [], registry)); setEdges(graph.edges || []);
      setDatasetId(graph.meta?.datasetId ?? null); setTargetColumn(graph.meta?.targetColumn || 'target'); setTaskType(graph.meta?.taskType || 'auto');
      setSelectedId(null); setSelectedEdgeId(null); setMessage('جریان بارگذاری شد');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'بارگذاری ناموفق بود'); }
  };

  const newWorkflow = () => {
    const graph = defaultGraph(registry);
    setCurrentWorkflowId(null); setWorkflowName('جریان IOTA ML'); setNodes(graph.nodes); setEdges(graph.edges); setTargetColumn('target'); setTaskType('auto'); setCurrentRun(null); setSelectedId(null); setSelectedEdgeId(null);
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
      const run = await api.createRun({ workflow_name: workflowName, workflow_graph: { nodes: graphToRun.nodes, edges: graphToRun.edges }, dataset_id: null, project_id: projectId, target_column: null, task_type: 'auto' });
      setCurrentRun(run);
      await refreshRunHistory();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'اجرا ناموفق بود'); setBusy(false); }
  };

  const runWorkflow = () => runGraphFromNode(selectedId);

  const retryRun = async (run: Run) => {
    if (!run.workflow_graph) return;
    setBusy(true);
    setMessage('اجرای قبلی دوباره شروع شد');
    try {
      const nextRun = await api.createRun({ workflow_name: run.workflow_name, workflow_graph: run.workflow_graph, dataset_id: run.dataset_id, project_id: projectId, target_column: run.target_column, task_type: run.task_type || 'auto' });
      setCurrentRun(nextRun);
      await refreshRunHistory();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'اجرای دوباره ناموفق بود'); setBusy(false); }
  };

  useEffect(() => {
    if (!currentRun || ['succeeded', 'failed'].includes(currentRun.status)) { setBusy(false); return; }
    const timer = window.setInterval(async () => {
      const next = await api.getRun(currentRun.id); setCurrentRun(next);
      if (['succeeded', 'failed'].includes(next.status)) { setBusy(false); setCurrentRun(next); refreshRunHistory().catch(() => undefined); window.clearInterval(timer); }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [currentRun, refreshRunHistory]);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resultsCollapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = resultsWidth;
    const move = (moveEvent: PointerEvent) => setResultsWidth(Math.min(760, Math.max(300, startWidth + (moveEvent.clientX - startX))));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const appStyle = {
    ['--results-width' as string]: resultsCollapsed ? '46px' : `${resultsWidth}px`,
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
    borderRadius: '24px',
    background: 'var(--workflow-shell-surface)',
    border: '1px solid var(--workflow-shell-border)',
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
    borderRadius: '20px',
    overflow: paletteCollapsed ? 'visible' : 'hidden',
    background: 'var(--workflow-shell-surface)',
    border: '1px solid var(--workflow-shell-border)',
    boxShadow: 'none'
  };

  const floatingRightStyle = {
    position: 'fixed' as const,
    top: `${panelTopOffset}px`,
    right: `${panelGap}px`,
    bottom: `${panelGap}px`,
    zIndex: 30,
    width: resultsCollapsed ? '52px' : `${resultsWidth}px`,
    borderRadius: '20px',
    overflow: 'hidden',
    background: 'var(--workflow-shell-surface)',
    border: '1px solid var(--workflow-shell-border)',
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
    <div className="app-shell" style={appStyle}>
      <style>{`
        .left-stack.left-stack-collapsed .palette-flyout {
          left: calc(100% + 8px) !important;
          right: auto !important;
        }
      `}</style>
      <header className="topbar workflow-topbar workflow-topbar-pro" dir="ltr" style={floatingTopbarStyle}>
        <div className="workflow-topbar-left" style={topbarLeftStyle}>
          <button className="icon-button danger-nav" type="button" onClick={onLogout} title="خروج" aria-label="خروج"><LogOut size={14} /></button>
          <button className="icon-button" type="button" onClick={onProfile} title="پروفایل" aria-label="پروفایل"><UserCircle size={14} /></button>
          <ThemeToggle />
          <button className="icon-button" type="button" onClick={onProjects} title="پنل پروژه‌ها" aria-label="پنل پروژه‌ها"><LayoutDashboard size={14} /></button>
          <button className="icon-button" type="button" title="بیشتر" aria-label="بیشتر"><MoreHorizontal size={14} /></button>
        </div>

        <div className="workflow-topbar-center" style={topbarCenterStyle}>

          <button className="icon-button" type="button" onClick={prettyLayout} title="چیدمان خودکار" aria-label="چیدمان خودکار"><LayoutGrid size={14} /></button>
          <button className="primary icon-only" type="button" disabled={busy} onClick={saveWorkflow} title="ذخیره" aria-label="ذخیره"><Save size={14} /></button>
          <button className="primary icon-only" title={selectedNode ? 'اجرای مسیر نود انتخاب‌شده' : 'اجرای برد'} aria-label="اجرا" disabled={busy || nodes.length === 0} onClick={runWorkflow}>{busy ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}</button>
          <button className="icon-button" type="button" onClick={newWorkflow} title="جریان جدید" aria-label="جریان جدید"><PlusCircle size={14} /></button>
          <button className="danger icon-only" title="حذف" aria-label="حذف" type="button" disabled={!selectedId && !selectedEdgeId && selectedIds.length === 0 && selectedEdgeIds.length === 0} onClick={deleteSelected}><Trash2 size={14} /></button>

        </div>

        <div className="workflow-topbar-right" style={topbarRightStyle}>
          <input className="workflow-name-input" style={{ width: '168px', minWidth: '120px', height: '32px' }} value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} aria-label="نام جریان" placeholder="نام جریان" />
          <div style={{ width: '164px', minWidth: '132px' }}><CustomSelect className="workflow-select" value={currentWorkflowId ? String(currentWorkflowId) : ''} options={workflowOptions} onChange={loadWorkflow} ariaLabel="لیست جریان‌ها" /></div>
          <div className="workflow-breadcrumb" dir="rtl" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><b style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.name}</b><span>›</span><span>IOTA ML</span></div>
          <button className="icon-button" type="button" onClick={onBack} title="بازگشت به پروژه" aria-label="بازگشت به پروژه"><ArrowRight size={14} /></button>
        </div>
      </header>

      <main className={`workspace ${paletteCollapsed ? 'palette-collapsed' : ''} ${resultsCollapsed ? 'results-collapsed' : ''}`} style={floatingWorkspaceStyle}>
        <div className={`left-stack ${paletteCollapsed ? 'left-stack-collapsed' : ''}`} style={floatingLeftStyle}>
          <button
            className="workflow-float-toggle workflow-float-toggle-left"
            type="button"
            onClick={() => setPaletteCollapsed((value) => !value)}
            title={paletteCollapsed ? 'باز کردن منوی چپ' : 'بستن منوی چپ'}
            aria-label={paletteCollapsed ? 'باز کردن منوی چپ' : 'بستن منوی چپ'}
            style={{
              top: paletteCollapsed ? '10px' : '12px',
              left: paletteCollapsed ? 'calc(100% + 8px)' : '12px',
              right: 'auto',
              zIndex: 100
            }}
          >
            {paletteCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
          <NodePalette nodes={registry} collapsed={paletteCollapsed} onToggle={() => setPaletteCollapsed((value) => !value)} />
        </div>
        <section className="board" onDrop={onDrop} onDragOver={onDragOver} style={floatingBoardStyle}>
          {message && <div className="toast">{message}</div>}
          <ReactFlow nodes={flowNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onSelectionChange={onSelectionChange} onNodeClick={onNodeClick} onNodeDoubleClick={onNodeDoubleClick} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick} selectionOnDrag multiSelectionKeyCode={multiSelectionKeys} fitView>
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.35} color="var(--board-dot)" /><Controls /><MiniMap pannable zoomable />
          </ReactFlow>
        </section>
        <div className="right-stack-wrap" style={floatingRightStyle}>
          <button className="workflow-float-toggle workflow-float-toggle-right" type="button" onClick={() => setResultsCollapsed((value) => !value)} title={resultsCollapsed ? 'باز کردن پنل راست' : 'بستن پنل راست'} aria-label={resultsCollapsed ? 'باز کردن پنل راست' : 'بستن پنل راست'}>
            {resultsCollapsed ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>
          {!resultsCollapsed && <div className="resize-handle" onPointerDown={startResize} title="تغییر عرض پنل نتایج" />}
          <div className="right-stack workflow-right-stack">
            {!resultsCollapsed && <div className="flow-chip"><b>{selectedFlow.mode === 'selected' ? 'جریان انتخاب‌شده' : 'کل برد'}</b><span>{selectedFlow.nodes.length} نود، {selectedFlow.edges.length} اتصال</span></div>}
            {!resultsCollapsed && (
              <section className="workflow-section-card">
                <button type="button" className="group-toggle workflow-section-toggle" onClick={() => setHistoryCollapsed((value) => !value)} aria-expanded={!historyCollapsed}>
                  <span className="group-title-main"><History size={13} /> تاریخچه اجرا و Debug</span>
                  {historyCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
                {!historyCollapsed && (
                  <div className="workflow-section-body workflow-history-body">
                    <RunHistoryPanel compact runs={runHistory} currentRunId={currentRun?.id} busy={busy} onSelect={(run) => { setCurrentRun(run); setMessage('خروجی اجرای قبلی برای Debug نمایش داده شد'); }} onRetry={retryRun} onRefresh={() => refreshRunHistory().catch(() => undefined)} />
                  </div>
                )}
              </section>
            )}
            {!resultsCollapsed && <Inspector selectedNode={selectedNode} selectedEdge={selectedEdge} registry={registry} datasets={datasets} availableColumns={availableColumns} onChange={updateNodeParams} onRename={renameNode} onDelete={deleteSelected} />}
            {!resultsCollapsed && (
              <section className="workflow-section-card workflow-results-shell">
                <button type="button" className="group-toggle workflow-section-toggle" onClick={() => setNodeResultsCollapsed((value) => !value)} aria-expanded={!nodeResultsCollapsed}>
                  <span className="group-title-main">خروجی نود انتخاب‌شده</span>
                  {nodeResultsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
                {!nodeResultsCollapsed && (
                  <div className="workflow-section-body workflow-results-body">
                    <ResultsPanel run={currentRun} selectedNodeId={selectedId} collapsed={false} onToggle={() => undefined} />
                  </div>
                )}
              </section>
            )}
            {resultsCollapsed && <ResultsPanel run={currentRun} selectedNodeId={selectedId} collapsed={true} onToggle={() => setResultsCollapsed((value) => !value)} />}
          </div>
        </div>
      </main>
      {modalNode && <NodeModal node={modalNode} edges={edges} registry={registry} datasets={datasets} availableColumns={availableColumns} run={currentRun} busy={busy} onRunNode={() => runGraphFromNode(modalNode.id)} onParamsChange={updateNodeParams} onRename={renameNode} onPinnedChange={updateNodePinned} onClose={() => setModalNodeId(null)} />}
    </div>
  );
}


