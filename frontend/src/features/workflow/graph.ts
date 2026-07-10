import type { Edge, Node } from '@xyflow/react';
import type { AnalysisBoardItem } from '../../components/AnalysisBoard';
import type { Output } from '../../components/ResultsPanel';
import type { Dataset, RegistryNode } from '../../types';
import { resolveRegistryId, type LegacyNodeAliases } from './catalog';

export type FlowGraph = {
  nodes: Node[];
  edges: Edge[];
  meta?: {
    datasetId?: number | null;
    targetColumn?: string;
    taskType?: string;
    analysisBoard?: AnalysisBoardItem[];
  };
};

const DEMO_COLUMNS: Record<string, string[]> = {
  data_demo_iris: ['sepal length (cm)', 'sepal width (cm)', 'petal length (cm)', 'petal width (cm)', 'target'],
  data_demo_wine: ['alcohol', 'malic_acid', 'ash', 'alcalinity_of_ash', 'magnesium', 'total_phenols', 'flavanoids', 'nonflavanoid_phenols', 'proanthocyanins', 'color_intensity', 'hue', 'od280/od315_of_diluted_wines', 'proline', 'target'],
  data_demo_breast_cancer: ['mean radius', 'mean texture', 'mean perimeter', 'mean area', 'mean smoothness', 'mean compactness', 'mean concavity', 'mean concave points', 'mean symmetry', 'mean fractal dimension', 'target'],
};

const SECTION_TITLES = new Set([
  'Data Input', 'Data Inspection', 'Data Cleaning', 'Anomaly Detection',
  'Transformation', 'Visualizations', 'ML Data Processing',
  'ML Model Design and Training', 'ML Model Analysis', 'Export or Report',
  'Utilities / Advanced', 'ورود داده', 'تبدیل داده', 'تحلیل و نمودار',
  'آموزش مدل', 'تحلیل مدل',
]);

function paramsFromRegistry(node: RegistryNode) {
  const schema = node.settingsSchema?.length ? node.settingsSchema : node.params || [];
  return Object.fromEntries(schema.map((param) => [param.name, param.default]));
}

export function makeNode(registryNode: RegistryNode, index: number, position?: { x: number; y: number }): Node {
  return {
    id: `${registryNode.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'mlNode',
    position: position ?? { x: 120 + (index % 4) * 260, y: 100 + Math.floor(index / 4) * 180 },
    data: {
      registryId: registryNode.id,
      catalogId: registryNode.id,
      typeLabel: registryNode.label,
      label: `Node ${index + 1}`,
      category: registryNode.category,
      description: registryNode.description,
      inputs: registryNode.inputs || [],
      outputs: registryNode.outputs || [],
      executionMode: registryNode.executionMode,
      comingSoon: registryNode.comingSoon,
      params: paramsFromRegistry(registryNode),
    },
  };
}

export function normalizeFlowNodes(
  items: Node[],
  registry: RegistryNode[],
  aliases: LegacyNodeAliases,
): Node[] {
  const byId = Object.fromEntries(registry.map((item) => [item.id, item]));
  return items.map((node, index) => {
    const storedRegistryId = String(node.data?.registryId || node.data?.catalogId || '');
    const canonicalId = resolveRegistryId(storedRegistryId, aliases);
    const registryNode = byId[canonicalId];
    const storedTypeLabel = String(node.data?.typeLabel || '').trim();
    const typeLabel = !storedTypeLabel || SECTION_TITLES.has(storedTypeLabel)
      ? String(registryNode?.label || node.data?.label || 'Node Type')
      : storedTypeLabel;
    const currentLabel = String(node.data?.label || '').trim();
    const label = !currentLabel || currentLabel === typeLabel || SECTION_TITLES.has(currentLabel)
      ? `Node ${index + 1}`
      : currentLabel;

    return {
      ...node,
      data: {
        ...node.data,
        registryId: canonicalId,
        catalogId: canonicalId,
        typeLabel,
        label,
        category: registryNode?.category || node.data?.category,
        description: registryNode?.description || node.data?.description,
        inputs: registryNode?.inputs || node.data?.inputs || [],
        outputs: registryNode?.outputs || node.data?.outputs || [],
        executionMode: registryNode?.executionMode || node.data?.executionMode || 'instant',
        comingSoon: registryNode?.comingSoon ?? node.data?.comingSoon ?? false,
      },
    };
  });
}

export function defaultGraph(registry: RegistryNode[], aliases: LegacyNodeAliases): FlowGraph {
  const byId = Object.fromEntries(registry.map((item) => [item.id, item]));
  const ids = ['DI-002', 'IN-004', 'CL-007', 'VZ-002'];
  const positions = [{ x: 90, y: 230 }, { x: 350, y: 230 }, { x: 610, y: 230 }, { x: 870, y: 230 }];
  const nodes = ids.filter((id) => byId[id]).map((id, index) => {
    const node = makeNode(byId[id], index, positions[index]);
    node.id = `${id}-${index}`;
    if (id === 'DI-002') {
      node.data = { ...node.data, params: { ...(node.data.params as Record<string, unknown>), dataset_id: null } };
    }
    return node;
  });
  const edges: Edge[] = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    edges.push({ id: `e${index}`, source: nodes[index].id, target: nodes[index + 1].id, animated: true });
  }
  return {
    nodes: normalizeFlowNodes(nodes, registry, aliases),
    edges,
    meta: { targetColumn: 'target', taskType: 'auto', datasetId: null },
  };
}

export function connectedGraph(allNodes: Node[], allEdges: Edge[], selectedNodeId: string | null) {
  if (!selectedNodeId || !allNodes.some((node) => node.id === selectedNodeId)) {
    return { nodes: allNodes, edges: allEdges, mode: 'all' as const };
  }
  const adjacent = new Map<string, Set<string>>();
  allNodes.forEach((node) => adjacent.set(node.id, new Set()));
  allEdges.forEach((edge) => {
    adjacent.get(edge.source)?.add(edge.target);
    adjacent.get(edge.target)?.add(edge.source);
  });
  const keep = new Set<string>();
  const queue = [selectedNodeId];
  while (queue.length) {
    const current = queue.shift()!;
    if (keep.has(current)) continue;
    keep.add(current);
    adjacent.get(current)?.forEach((next) => !keep.has(next) && queue.push(next));
  }
  return {
    nodes: allNodes.filter((node) => keep.has(node.id)),
    edges: allEdges.filter((edge) => keep.has(edge.source) && keep.has(edge.target)),
    mode: 'selected' as const,
  };
}

export function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement;
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

function flowNodeRegistryId(node: Node | undefined, aliases: LegacyNodeAliases) {
  const raw = String(node?.data?.registryId || node?.data?.catalogId || '');
  return resolveRegistryId(raw, aliases);
}

function parentNodeIds(edges: Edge[], nodeId: string) {
  return edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source);
}

function datasetColumnsForFlowNode(
  node: Node,
  datasets: Dataset[],
  workflowDatasetId: number | null,
  aliases: LegacyNodeAliases,
) {
  const storedId = String(node.data.registryId || '');
  if (DEMO_COLUMNS[storedId]) return DEMO_COLUMNS[storedId];
  if (flowNodeRegistryId(node, aliases) !== 'DI-002') return [];
  const params = (node.data.params || {}) as Record<string, unknown>;
  const datasetId = Number(params.dataset_id || workflowDatasetId || 0);
  const dataset = datasets.find((item) => item.id === datasetId);
  return dataset ? dataset.columns.map((column) => column.name) : [];
}

function outputColumnsForNode(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  datasets: Dataset[],
  workflowDatasetId: number | null,
  aliases: LegacyNodeAliases,
  visiting = new Set<string>(),
): string[] {
  if (visiting.has(nodeId)) return [];
  visiting.add(nodeId);
  const node = nodes.find((item) => item.id === nodeId);
  if (!node) return [];

  const catalogId = flowNodeRegistryId(node, aliases);
  const params = (node.data.params || {}) as Record<string, unknown>;
  const sourceColumns = datasetColumnsForFlowNode(node, datasets, workflowDatasetId, aliases);
  if (sourceColumns.length) return uniqColumns(sourceColumns);

  const parentColumns = uniqColumns(parentNodeIds(edges, nodeId).flatMap((parentId) => (
    outputColumnsForNode(parentId, nodes, edges, datasets, workflowDatasetId, aliases, new Set(visiting))
  )));

  if (catalogId === 'CL-006') {
    const selected = parseColumnParam(params.columns);
    const idColumn = String(params.id_column || '');
    const mode = String(params.mode || 'select');
    let next = parentColumns;
    if (mode === 'drop' && selected.length) next = parentColumns.filter((column) => !selected.includes(column));
    if (mode !== 'drop' && selected.length) next = selected.filter((column) => parentColumns.includes(column));
    if (idColumn && parentColumns.includes(idColumn) && !next.includes(idColumn)) next = [idColumn, ...next];
    return uniqColumns(next);
  }

  if (catalogId === 'MP-002') {
    const target = String(params.target_column || '');
    const features = parseColumnParam(params.columns).filter((column) => column !== target && parentColumns.includes(column));
    return uniqColumns([...features, ...(target && parentColumns.includes(target) ? [target] : [])]);
  }

  return parentColumns;
}

export function inputColumnsForNode(
  nodeId: string | null,
  nodes: Node[],
  edges: Edge[],
  datasets: Dataset[],
  workflowDatasetId: number | null,
  aliases: LegacyNodeAliases,
) {
  if (!nodeId) return [];
  const node = nodes.find((item) => item.id === nodeId);
  if (!node) return [];
  if (flowNodeRegistryId(node, aliases) === 'DI-002') {
    return datasetColumnsForFlowNode(node, datasets, workflowDatasetId, aliases);
  }
  return uniqColumns(parentNodeIds(edges, nodeId).flatMap((parentId) => (
    outputColumnsForNode(parentId, nodes, edges, datasets, workflowDatasetId, aliases)
  )));
}

export function boardOutputTitle(output: Output, index: number) {
  const base = String(output.title || `خروجی ${index + 1}`);
  const source = String(output.source_label || output.branch || '').trim();
  return source ? `${base} · ${source}` : base;
}

export function restoreAnalysisBoardItems(value: unknown): AnalysisBoardItem[] {
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
      createdAt: String(item.createdAt || new Date().toISOString()),
    }));
}

export function serializeAnalysisBoardItems(items: AnalysisBoardItem[]) {
  return items.map(({ snapshot: _snapshot, ...item }) => item);
}

export function workflowOutputSignature(
  nodes: Node[],
  edges: Edge[],
  datasetId: number | null,
  targetColumn: string,
  taskType: string,
) {
  return JSON.stringify({
    nodes: nodes.map((node) => ({
      id: node.id,
      registryId: node.data?.registryId,
      catalogId: node.data?.catalogId,
      params: node.data?.params,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    })),
    datasetId,
    targetColumn,
    taskType,
  });
}
