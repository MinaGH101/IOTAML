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
import { ArrowRight, LayoutDashboard, LayoutGrid, LogOut, MoreHorizontal, Play, PlusCircle, RefreshCw, Save, Trash2, UserCircle } from 'lucide-react';
import { api } from '../api';
import { CustomSelect } from '../components/CustomSelect';
import { AnalysisBoard, type AnalysisBoardItem } from '../components/AnalysisBoard';
import { NodeModal } from '../components/NodeModal';
import { ThemeToggle } from '../components/ThemeToggle';
import { normalizeOutputs, type Output } from '../components/ResultsPanel';
import { NodeMenu } from './NodeMenu';
import { RightPanel } from './RightPanel';
import { MlNode } from '../nodes/MlNode';
import type { Dataset, Project, RegistryNode, Run, UserProfile, Workflow } from '../types';
import { sameStringArray } from '../utils/appShared';

const nodeTypes = { mlNode: MlNode };
const multiSelectionKeys = ['Meta', 'Control', 'Shift'];

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
type FlowGraph = { nodes: Node[]; edges: Edge[]; meta?: { datasetId?: number | null; targetColumn?: string; taskType?: string; analysisBoard?: AnalysisBoardItem[] } };
const COMPATIBLE_PORTS: Record<string, string[]> = {
  any: ['any','dataframe','json','json_items','series','columns','model','metrics','plot','file','report','artifact','artifact_ref','text','schema','trigger','stream'],
  dataframe: ['dataframe','any','json','artifact_ref','report'],
  json_items: ['json_items','json','any','artifact_ref','report','dataframe'],
  json: ['json','json_items','any','metrics','report'],
  metrics: ['metrics','json','any','report'],
  plot: ['plot','artifact','artifact_ref','report','any'],
  artifact_ref: ['artifact_ref','artifact','file','report','any'],
  artifact: ['artifact','artifact_ref','file','report','any'],
  file: ['file','artifact_ref','artifact','any'],
  model: ['model','artifact_ref','artifact','any'],
  schema: ['schema','json','any'],
  series: ['series','columns','json','any'],
  columns: ['columns','json','any'],
  text: ['text','json','any'],
  trigger: ['trigger','any'],
  stream: ['stream','json_items','any']
};

const DEMO_COLUMNS: Record<string, string[]> = {
  data_demo_iris: ['sepal length (cm)', 'sepal width (cm)', 'petal length (cm)', 'petal width (cm)', 'target'],
  data_demo_wine: ['alcohol', 'malic_acid', 'ash', 'alcalinity_of_ash', 'magnesium', 'total_phenols', 'flavanoids', 'nonflavanoid_phenols', 'proanthocyanins', 'color_intensity', 'hue', 'od280/od315_of_diluted_wines', 'proline', 'target'],
  data_demo_breast_cancer: ['mean radius', 'mean texture', 'mean perimeter', 'mean area', 'mean smoothness', 'mean compactness', 'mean concavity', 'mean concave points', 'mean symmetry', 'mean fractal dimension', 'target']
};

const LEGACY_NODE_ALIASES: Record<string, string> = {
  data_csv: 'DI-002',
  data_demo: 'DI-002',
  data_demo_iris: 'DI-002',
  data_demo_wine: 'DI-002',
  data_demo_breast_cancer: 'DI-002',
  data_select_target_features: 'MP-002',
  data_select_features: 'MP-002',
  data_select_target: 'MP-002',
  data_train_test_split: 'MP-001',
  data_kfold_split: 'MP-004',
  data_filter_rows: 'CL-007',
  data_sort_rows: 'CL-007',
  data_sample_rows: 'CL-006',
  transform_drop_columns: 'CL-006',
  transform_simple_imputer: 'CL-001',
  transform_replace_values: 'CL-008',
  transform_standard_scaler: 'TR-003',
  transform_minmax_scaler: 'TR-001',
  transform_robust_scaler: 'TR-004',
  transform_one_hot: 'MP-005',
  transform_ordinal: 'MP-005',
  transform_pca: 'TR-010',
  transform_select_k_best: 'MP-001',
  transform_variance_threshold: 'MP-001',
  analysis_summary: 'IN-003',
  analysis_missing: 'IN-004',
  analysis_correlation: 'IN-006',
  analysis_histogram: 'VZ-002',
  analysis_scatter: 'VZ-003',
  analysis_boxplot: 'VZ-004',
  analysis_class_balance: 'IN-003',
  analysis_outliers: 'AD-001',
  analysis_feature_distribution: 'VZ-002',
  analysis_pairwise_sample: 'VZ-003',
  analysis_only: 'IN-003',
  model_logistic_regression: 'MT-004',
  model_random_forest_classifier: 'MT-005',
  model_gradient_boosting_classifier: 'MT-007',
  model_svc: 'MT-006',
  model_knn_classifier: 'MT-008',
  model_decision_tree_classifier: 'MT-006',
  model_linear_regression: 'MT-004',
  model_ridge: 'MT-004',
  model_random_forest_regressor: 'MT-005',
  model_gradient_boosting_regressor: 'MT-007',
  model_extra_trees_classifier: 'MT-005',
  model_adaboost_classifier: 'MT-005',
  model_hist_gradient_boosting_classifier: 'MT-005',
  model_gaussian_nb: 'MT-004',
  model_mlp_classifier: 'MT-009',
  model_decision_tree_regressor: 'MT-006',
  model_knn_regressor: 'MT-008',
  model_svr: 'MT-006',
  model_extra_trees_regressor: 'MT-005',
  model_adaboost_regressor: 'MT-005',
  model_hist_gradient_boosting_regressor: 'MT-005',
  model_lasso: 'MT-004',
  model_elastic_net: 'MT-004',
  model_mlp_regressor: 'MT-009',
  model_metrics: 'MA-003',
  model_confusion_matrix: 'MA-004',
  model_roc_auc: 'MA-003',
  model_feature_importance: 'MA-006',
  model_permutation_importance: 'MA-007',
  model_shap_summary: 'MA-007',
  model_learning_curve: 'MA-009',
  model_residual_plot: 'MA-005',
  model_prediction_preview: 'MA-001',
  model_prediction_plot: 'MA-001',
  model_compare: 'MA-010'
};

function resolveRegistryId(id: string) {
  return LEGACY_NODE_ALIASES[id] || id;
}

function paramsFromRegistry(node: RegistryNode) {
  const schema = node.settingsSchema?.length ? node.settingsSchema : node.params || [];
  return Object.fromEntries(schema.map((param) => [param.name, param.default]));
}

function makeNode(registryNode: RegistryNode, index: number, position?: { x: number; y: number }): Node {
  return {
    id: `${registryNode.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'mlNode',
    position: position ?? { x: 120 + (index % 4) * 260, y: 100 + Math.floor(index / 4) * 180 },
    data: { registryId: registryNode.id, typeLabel: registryNode.label, label: `Node ${index + 1}`, category: registryNode.category, description: registryNode.description, inputs: registryNode.inputs || [], outputs: registryNode.outputs || [], executionMode: registryNode.executionMode, comingSoon: registryNode.comingSoon, params: paramsFromRegistry(registryNode) }
  };
}

function normalizeFlowNodes(items: Node[], registry: RegistryNode[]) {
  const byId = Object.fromEntries(registry.map((item) => [item.id, item]));
  const sectionTitles = new Set(['Data Input','Data Inspection','Data Cleaning','Anomaly Detection','Transformation','Visualizations','ML Data Processing','ML Model Design and Training','ML Model Analysis','Export or Report','Utilities / Advanced','ورود داده','تبدیل داده','تحلیل و نمودار','آموزش مدل','تحلیل مدل']);
  return items.map((node, index) => {
    const registryId = String(node.data?.registryId || '');
    const catalogId = resolveRegistryId(registryId);
    const registryNode = byId[registryId] || byId[catalogId];
    const storedTypeLabel = String(node.data?.typeLabel || '').trim();
    const typeLabel = !storedTypeLabel || sectionTitles.has(storedTypeLabel) ? String(registryNode?.label || node.data?.label || 'Node Type') : storedTypeLabel;
    const currentLabel = String(node.data?.label || '').trim();
    const label = !currentLabel || currentLabel === typeLabel || sectionTitles.has(currentLabel) ? `Node ${index + 1}` : currentLabel;
    return { ...node, data: { ...node.data, catalogId, typeLabel, label, category: node.data?.category || registryNode?.category, description: node.data?.description || registryNode?.description, inputs: registryNode?.inputs || node.data?.inputs || [], outputs: registryNode?.outputs || node.data?.outputs || [], executionMode: registryNode?.executionMode || node.data?.executionMode || 'instant', comingSoon: registryNode?.comingSoon ?? node.data?.comingSoon ?? false } };
  });
}

function defaultGraph(registry: RegistryNode[]): FlowGraph {
  const byId = Object.fromEntries(registry.map((item) => [item.id, item]));
  const ids = ['DI-002', 'IN-004', 'CL-007', 'VZ-002'];
  const positions = [{ x: 90, y: 230 }, { x: 350, y: 230 }, { x: 610, y: 230 }, { x: 870, y: 230 }];
  const nodes = ids.filter((id) => byId[id]).map((id, index) => {
    const node = makeNode(byId[id], index, positions[index]);
    node.id = `${id}-${index}`;
    if (id === 'DI-002') node.data = { ...node.data, params: { ...(node.data.params as Record<string, unknown>), dataset_id: null } };
    return node;
  });
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) edges.push({ id: `e${i}`, source: nodes[i].id, target: nodes[i + 1].id, animated: true });
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

function parseColumnParam(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== 'string') return [];
  const text = value.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // Fall back to comma-separated text.
  }
  return text.split(',').map((item) => item.trim()).filter(Boolean);
}

function uniqColumns(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function flowNodeRegistryId(node: Node | undefined) {
  const raw = String(node?.data?.registryId || node?.data?.catalogId || '');
  return resolveRegistryId(raw);
}

function parentNodeIds(edges: Edge[], nodeId: string) {
  return edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source);
}

function datasetColumnsForFlowNode(node: Node, datasets: Dataset[], workflowDatasetId: number | null) {
  const rid = String(node.data.registryId || '');
  if (DEMO_COLUMNS[rid]) return DEMO_COLUMNS[rid];
  const catalogId = flowNodeRegistryId(node);
  if (catalogId !== 'DI-002') return [];
  const params = (node.data.params || {}) as Record<string, unknown>;
  const dsId = Number(params.dataset_id || workflowDatasetId || 0);
  const ds = datasets.find((item) => item.id === dsId);
  return ds ? ds.columns.map((column) => column.name) : [];
}

function outputColumnsForNode(nodeId: string, nodes: Node[], edges: Edge[], datasets: Dataset[], workflowDatasetId: number | null, visiting = new Set<string>()): string[] {
  if (visiting.has(nodeId)) return [];
  visiting.add(nodeId);

  const node = nodes.find((item) => item.id === nodeId);
  if (!node) return [];

  const catalogId = flowNodeRegistryId(node);
  const params = (node.data.params || {}) as Record<string, unknown>;
  const sourceCols = datasetColumnsForFlowNode(node, datasets, workflowDatasetId);
  if (sourceCols.length) return uniqColumns(sourceCols);

  const parentCols = uniqColumns(
    parentNodeIds(edges, nodeId).flatMap((parentId) => outputColumnsForNode(parentId, nodes, edges, datasets, workflowDatasetId, new Set(visiting)))
  );

  if (catalogId === 'CL-006') {
    const selected = parseColumnParam(params.columns);
    const idColumn = String(params.id_column || '');
    const mode = String(params.mode || 'select');
    let next = parentCols;
    if (mode === 'drop' && selected.length) next = parentCols.filter((column) => !selected.includes(column));
    if (mode !== 'drop' && selected.length) next = selected.filter((column) => parentCols.includes(column));
    if (idColumn && parentCols.includes(idColumn) && !next.includes(idColumn)) next = [idColumn, ...next];
    return uniqColumns(next);
  }

  if (catalogId === 'MP-002') {
    const target = String(params.target_column || '');
    const features = parseColumnParam(params.columns).filter((column) => column !== target && parentCols.includes(column));
    return uniqColumns([...features, ...(target && parentCols.includes(target) ? [target] : [])]);
  }

  return parentCols;
}

function inputColumnsForNode(nodeId: string | null, nodes: Node[], edges: Edge[], datasets: Dataset[], workflowDatasetId: number | null) {
  if (!nodeId) return [];
  const node = nodes.find((item) => item.id === nodeId);
  if (!node) return [];
  if (flowNodeRegistryId(node) === 'DI-002') return datasetColumnsForFlowNode(node, datasets, workflowDatasetId);
  return uniqColumns(parentNodeIds(edges, nodeId).flatMap((parentId) => outputColumnsForNode(parentId, nodes, edges, datasets, workflowDatasetId)));
}

function registryForFlowNode(node: Node | undefined, registry: RegistryNode[]) {
  if (!node) return null;
  const registryId = String(node.data?.catalogId || node.data?.registryId || '');
  const catalogId = resolveRegistryId(registryId);
  return registry.find((item) => item.id === registryId) || registry.find((item) => item.id === catalogId) || null;
}

function portTypeFor(node: Node | undefined, registry: RegistryNode[], handle: string | null | undefined, side: 'source' | 'target') {
  const def = registryForFlowNode(node, registry);
  const ports = side === 'source' ? def?.outputs : def?.inputs;
  if (!ports?.length) return 'any';
  const port = handle ? ports.find((item) => item.id === handle) : ports[0];
  return String((port || ports[0]).type || 'any');
}

function compatiblePorts(sourceType: string, targetType: string) {
  if (sourceType === targetType || sourceType === 'any' || targetType === 'any') return true;
  return (COMPATIBLE_PORTS[sourceType] || []).includes(targetType);
}

function boardOutputTitle(output: Output, index: number) {
  const base = String(output.title || `خروجی ${index + 1}`);
  const source = String(output.source_label || output.branch || '').trim();
  return source ? `${base} · ${source}` : base;
}

function restoreAnalysisBoardItems(value: unknown): AnalysisBoardItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Partial<AnalysisBoardItem> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    .map((item, index) => ({
      id: String(item.id || `board-${Date.now()}-${index}`),
      nodeId: item.nodeId ? String(item.nodeId) : null,
      outputIndex: Number(item.outputIndex || 0),
      outputTitle: String(item.outputTitle || `خروجی ${index + 1}`),
      outputKind: String(item.outputKind || 'json'),
      sourceLabel: item.sourceLabel ? String(item.sourceLabel) : undefined,
      x: Number.isFinite(Number(item.x)) ? Number(item.x) : 32 + index * 28,
      y: Number.isFinite(Number(item.y)) ? Number(item.y) : 32 + index * 28,
      w: Number.isFinite(Number(item.w)) ? Number(item.w) : 430,
      h: Number.isFinite(Number(item.h)) ? Number(item.h) : 320,
      runId: item.runId === undefined ? null : Number(item.runId) || null,
      snapshot: item.snapshot,
      createdAt: String(item.createdAt || new Date().toISOString())
    }));
}

function serializeAnalysisBoardItems(items: AnalysisBoardItem[]) {
  return items.map(({ snapshot: _snapshot, ...item }) => item);
}

function workflowOutputSignature(nodes: Node[], edges: Edge[], datasetId: number | null, targetColumn: string, taskType: string) {
  return JSON.stringify({
    nodes: nodes.map((node) => ({ id: node.id, registryId: node.data?.registryId, catalogId: node.data?.catalogId, params: node.data?.params })),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle })),
    datasetId,
    targetColumn,
    taskType
  });
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
  const [quickSettingsCollapsed, setQuickSettingsCollapsed] = useState(false);
  const [analysisBoardOpen, setAnalysisBoardOpen] = useState(false);
  const [analysisBoardItems, setAnalysisBoardItems] = useState<AnalysisBoardItem[]>([]);
  const [lastRunSignature, setLastRunSignature] = useState('');

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
          setAnalysisBoardItems(restoreAnalysisBoardItems(graph.meta?.analysisBoard));
          setAnalysisBoardOpen(false);
          setLastRunSignature('');
          setMessage('جریان بارگذاری شد');
          return;
        }

        const graph = defaultGraph(nodeRegistry);
        setNodes(graph.nodes); setEdges(graph.edges);
        setAnalysisBoardItems([]);
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
    return inputColumnsForNode(editorNodeId, nodes, edges, datasets, datasetId);
  }, [nodes, edges, selectedId, modalNodeId, datasets, datasetId]);

  const allRunOutputs = useMemo(() => normalizeOutputs(currentRun, null), [currentRun]);
  const currentOutputSignature = useMemo(() => workflowOutputSignature(nodes, edges, datasetId, targetColumn, taskType), [nodes, edges, datasetId, targetColumn, taskType]);
  const workflowDirtyForBoard = Boolean(currentRun && lastRunSignature && currentOutputSignature !== lastRunSignature);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((items) => applyNodeChanges(changes, items)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((items) => applyEdgeChanges(changes, items)), []);
  const onConnect = useCallback((connection: Connection) => {
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);
    const sourceType = portTypeFor(sourceNode, registry, connection.sourceHandle, 'source');
    const targetType = portTypeFor(targetNode, registry, connection.targetHandle, 'target');
    if (!compatiblePorts(sourceType, targetType)) {
      setMessage(`اتصال نامعتبر است: ${sourceType} → ${targetType}`);
      return;
    }
    setEdges((items) => addEdge({ ...connection, animated: true }, items));
  }, [nodes, registry]);

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

  const addOutputToBoard = useCallback((output: Output, visibleIndex: number) => {
    const nodeId = output.node_id ? String(output.node_id) : selectedId;
    const nodeOutputs = allRunOutputs.filter((item) => String(item.node_id || '') === String(nodeId || ''));
    const nodeOutputIndex = nodeOutputs.findIndex((item) => item === output);
    const outputIndex = nodeOutputIndex >= 0 ? nodeOutputIndex : visibleIndex;
    const nodeLabel = nodes.find((node) => node.id === nodeId)?.data?.label;
    const item: AnalysisBoardItem = {
      id: `board-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      nodeId,
      outputIndex,
      outputTitle: boardOutputTitle(output, outputIndex),
      outputKind: String(output.kind || 'json'),
      sourceLabel: nodeLabel ? String(nodeLabel) : undefined,
      x: 28 + (analysisBoardItems.length % 4) * 34,
      y: 28 + (analysisBoardItems.length % 4) * 34,
      w: 440,
      h: 330,
      runId: currentRun?.id ?? null,
      snapshot: output,
      createdAt: new Date().toISOString()
    };
    setAnalysisBoardItems((items) => [...items, item]);
    setAnalysisBoardOpen(true);
    setMessage('خروجی به Analysis Board اضافه شد');
  }, [allRunOutputs, analysisBoardItems.length, currentRun?.id, nodes, selectedId]);

  const updateBoardItem = useCallback((id: string, patch: Partial<AnalysisBoardItem>) => {
    setAnalysisBoardItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeBoardItem = useCallback((id: string) => {
    setAnalysisBoardItems((items) => items.filter((item) => item.id !== id));
  }, []);

  const duplicateBoardItem = useCallback((item: AnalysisBoardItem) => {
    setAnalysisBoardItems((items) => [...items, { ...item, id: `board-${Date.now()}-${Math.random().toString(16).slice(2)}`, x: item.x + 26, y: item.y + 26, createdAt: new Date().toISOString() }]);
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

  const graphPayload = (): FlowGraph => ({ nodes, edges, meta: { datasetId, targetColumn, taskType, analysisBoard: serializeAnalysisBoardItems(analysisBoardItems) } });

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
      setAnalysisBoardItems(restoreAnalysisBoardItems(graph.meta?.analysisBoard));
      setAnalysisBoardOpen(false);
      setLastRunSignature('');
      setSelectedId(null); setSelectedEdgeId(null); setMessage('جریان بارگذاری شد');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'بارگذاری ناموفق بود'); }
  };

  const newWorkflow = () => {
    const graph = defaultGraph(registry);
    setCurrentWorkflowId(null); setWorkflowName('جریان IOTA ML'); setNodes(graph.nodes); setEdges(graph.edges); setTargetColumn('target'); setTaskType('auto'); setAnalysisBoardItems([]); setAnalysisBoardOpen(false); setLastRunSignature(''); setCurrentRun(null); setSelectedId(null); setSelectedEdgeId(null);
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
      const validation = await api.validateWorkflow(graph as unknown as Record<string, unknown>);
      if (!validation.valid) {
        setMessage(validation.errors.map((item) => item.message).join(' · ') || 'اعتبارسنجی جریان ناموفق بود');
        setBusy(false);
        return;
      }
      if (validation.warnings.length) setMessage(validation.warnings[0].message);
      const run = await api.createRun({ workflow_name: workflowName, workflow_graph: graph, dataset_id: datasetId, project_id: projectId, target_column: targetColumn, task_type: taskType || 'auto' });
      setCurrentRun(run);
      setLastRunSignature(currentOutputSignature);
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
      setLastRunSignature(currentOutputSignature);
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
    const move = (moveEvent: PointerEvent) => setResultsWidth(Math.min(760, Math.max(300, startWidth + (startX - moveEvent.clientX))));
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
    borderRadius: '16px',
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
    borderRadius: '16px',
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
    borderRadius: '16px',
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
    <div className="app-shell workflow-shell-page" style={appStyle}>
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
          <button className="primary icon-only" title={selectedNode ? 'اجرای مسیر نود انتخاب‌شده' : 'اجرای برد'} aria-label="اجرا" disabled={busy || nodes.length === 0} onClick={runWorkflow}>{busy ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}</button>
          <button className="primary icon-only" type="button" disabled={busy} onClick={saveWorkflow} title="ذخیره" aria-label="ذخیره"><Save size={14} /></button>
          <button className={`icon-button ${analysisBoardOpen ? 'active' : ''}`} type="button" onClick={() => setAnalysisBoardOpen((value) => !value)} title={analysisBoardOpen ? 'بازگشت به Workflow' : 'Analysis Board'} aria-label={analysisBoardOpen ? 'بازگشت به Workflow' : 'Analysis Board'}><BoardIcon size={14} /></button>
          <button className="icon-button" type="button" onClick={prettyLayout} title="چیدمان خودکار" aria-label="چیدمان خودکار"><LayoutGrid size={14} /></button>
          <button className="danger icon-only" title="حذف" aria-label="حذف" type="button" disabled={!selectedId && !selectedEdgeId && selectedIds.length === 0 && selectedEdgeIds.length === 0} onClick={deleteSelected}><Trash2 size={14} /></button>
          <button className="icon-button" type="button" onClick={newWorkflow} title="جریان جدید" aria-label="جریان جدید"><PlusCircle size={14} /></button>
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
          <button className="icon-button" type="button" onClick={onBack} title="بازگشت به پروژه" aria-label="بازگشت به پروژه"><ArrowRight size={14} /></button>
        </div>
      </header>

      <main className={`workspace ${paletteCollapsed ? 'palette-collapsed' : ''} ${resultsCollapsed ? 'results-collapsed' : ''}`} style={floatingWorkspaceStyle}>
        <NodeMenu
          registry={registry}
          paletteCollapsed={paletteCollapsed}
          setPaletteCollapsed={setPaletteCollapsed}
          floatingLeftStyle={floatingLeftStyle}
        />
        <section className="board" onDrop={onDrop} onDragOver={onDragOver} style={floatingBoardStyle}>
          {message && <div className="toast">{message}</div>}
          <div className={`workflow-flow-layer ${analysisBoardOpen ? 'is-hidden' : ''}`}>
            <ReactFlow nodes={flowNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onSelectionChange={onSelectionChange} onNodeClick={onNodeClick} onNodeDoubleClick={onNodeDoubleClick} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick} selectionOnDrag multiSelectionKeyCode={multiSelectionKeys} fitView>
              <Background variant={BackgroundVariant.Dots} gap={24} size={1.35} color="var(--board-dot)" /><Controls /><MiniMap className="workflow-minimap-visible" pannable zoomable style={{ left: paletteCollapsed ? 76 : 304, right: 'auto', bottom: 24 }} />
            </ReactFlow>
          </div>
          {analysisBoardOpen && (
            <AnalysisBoard
              items={analysisBoardItems}
              run={currentRun}
              busy={busy}
              workflowDirty={workflowDirtyForBoard}
              onClose={() => setAnalysisBoardOpen(false)}
              onRun={runWorkflow}
              onAddOutput={addOutputToBoard}
              onUpdateItem={updateBoardItem}
              onRemoveItem={removeBoardItem}
              onDuplicateItem={duplicateBoardItem}
              onClear={() => setAnalysisBoardItems([])}
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
          setCurrentRun={setCurrentRun}
          setMessage={setMessage}
          retryRun={retryRun}
          refreshRunHistory={refreshRunHistory}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          registry={registry}
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
          onAddOutputToBoard={addOutputToBoard}
        />
      </main>
      {modalNode && <NodeModal node={modalNode} edges={edges} registry={registry} datasets={datasets} availableColumns={availableColumns} run={currentRun} busy={busy} onRunNode={() => runGraphFromNode(modalNode.id)} onParamsChange={updateNodeParams} onRename={renameNode} onPinnedChange={updateNodePinned} onClose={() => setModalNodeId(null)} />}
    </div>
  );
}


