import type { Edge, Node } from '@xyflow/react';
import type { Output } from './output';
import { dataframeContextFromOutputs, outputsForIncomingEdge } from './runtimeContext.ts';
import type { Dataset } from '../../shared/types';
import { resolveRegistryId, type LegacyNodeAliases } from './registryAliases.ts';
export type ColumnContext = {
    activeColumns: string[];
    sourceColumns: string[];
    idColumn: string | null;
};
const EMPTY_CONTEXT: ColumnContext = { activeColumns: [], sourceColumns: [], idColumn: null };
const DATAFRAME_PORT_TYPES = new Set(['dataframe', 'any']);
const DEMO_COLUMNS: Record<string, string[]> = {
    data_demo_iris: ['sepal length (cm)', 'sepal width (cm)', 'petal length (cm)', 'petal width (cm)', 'target'],
    data_demo_wine: ['alcohol', 'malic_acid', 'ash', 'alcalinity_of_ash', 'magnesium', 'total_phenols', 'flavanoids', 'nonflavanoid_phenols', 'proanthocyanins', 'color_intensity', 'hue', 'od280/od315_of_diluted_wines', 'proline', 'target'],
    data_demo_breast_cancer: ['mean radius', 'mean texture', 'mean perimeter', 'mean area', 'mean smoothness', 'mean compactness', 'mean concavity', 'mean concave points', 'mean symmetry', 'mean fractal dimension', 'target'],
};
export function parseColumnParam(value: unknown): string[] {
    if (Array.isArray(value))
        return value.map(String).filter(Boolean);
    if (typeof value !== 'string')
        return [];
    const text = value.trim();
    if (!text)
        return [];
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed))
            return parsed.map(String).filter(Boolean);
    }
    catch {
        // Stored legacy values may be comma-separated.
    }
    return text.split(',').map((item) => item.trim()).filter(Boolean);
}
function unique(values: string[]) {
    return [...new Set(values.filter(Boolean))];
}
export function createColumnContextResolver(nodes: Node[], edges: Edge[], datasets: Dataset[], workflowDatasetId: number | null, aliases: LegacyNodeAliases, outputs: Output[] = []) {
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const datasetsById = new Map(datasets.map((dataset) => [dataset.id, dataset]));
    const incomingByNode = new Map<string, Edge[]>();
    edges.forEach((edge) => {
        const incoming = incomingByNode.get(edge.target);
        if (incoming)
            incoming.push(edge);
        else
            incomingByNode.set(edge.target, [edge]);
    });
    const columnsCache = new Map<string, string[]>();
    const idCache = new Map<string, string | null>();
    let resolutionCount = 0;
    const registryId = (node: Node | undefined) => resolveRegistryId(String(node?.data?.registryId || node?.data?.catalogId || ''), aliases);
    const params = (node: Node) => (node.data.params || {}) as Record<string, unknown>;
    const incoming = (nodeId: string) => incomingByNode.get(nodeId) || [];
    const portType = (edge: Edge) => {
        const ports = (nodesById.get(edge.source)?.data?.outputs || []) as Array<{
            id?: string;
            type?: string;
        }>;
        if (!ports.length)
            return 'any';
        const selected = edge.sourceHandle ? ports.find((port) => String(port.id || '') === edge.sourceHandle) : ports[0];
        if (!selected) return 'invalid';
        return String(selected?.type || 'any');
    };
    const dataframeParents = (nodeId: string) => incoming(nodeId).filter((edge) => DATAFRAME_PORT_TYPES.has(portType(edge)));
    const datasetColumns = (node: Node) => {
        const storedId = String(node.data.registryId || '');
        if (DEMO_COLUMNS[storedId])
            return DEMO_COLUMNS[storedId];
        if (registryId(node) !== 'DI-002')
            return [];
        const datasetId = Number(params(node).dataset_id || workflowDatasetId || 0);
        return datasetsById.get(datasetId)?.columns.map((column) => column.name) || [];
    };
    const outputsByNode = new Map<string, Output[]>();
    outputs.forEach((output) => {
        const id = String(output.node_id || '');
        outputsByNode.set(id, [...(outputsByNode.get(id) || []), output]);
    });
    const edgeContext = (edge: Edge): ColumnContext | null => {
        const sourceOutputs = outputsByNode.get(edge.source);
        if (!sourceOutputs) return null;
        const selected = outputsForIncomingEdge(sourceOutputs, edge, nodesById);
        return dataframeContextFromOutputs(selected) || EMPTY_CONTEXT;
    };
    const edgeColumns = (edge: Edge, visiting = new Set<string>()): string[] => {
        const runtime = edgeContext(edge);
        if (runtime) return unique([...(runtime.idColumn ? [runtime.idColumn] : []), ...runtime.activeColumns]);
        const columns = resolveColumns(edge.source, visiting);
        const node = nodesById.get(edge.source);
        if (node && registryId(node) === 'MP-002' && edge.sourceHandle === 'features') {
            return columns.filter((column) => column !== String(params(node).target_column || '') && column !== resolveId(edge.source));
        }
        return columns;
    };
    const edgeId = (edge: Edge, visiting = new Set<string>()): string | null => {
        const runtime = edgeContext(edge);
        return runtime ? runtime.idColumn : resolveId(edge.source, visiting);
    };
    const resolveId = (nodeId: string, visiting = new Set<string>()): string | null => {
        if (idCache.has(nodeId))
            return idCache.get(nodeId) ?? null;
        if (visiting.has(nodeId))
            return null;
        const node = nodesById.get(nodeId);
        if (!node)
            return null;
        resolutionCount += 1;
        const nextVisiting = new Set(visiting).add(nodeId);
        const catalogId = registryId(node);
        const nodeParams = params(node);
        let result: string | null;
        if (catalogId === 'DI-002')
            result = String(nodeParams.id_column || '').trim() || null;
        else if (catalogId === 'IN-008')
            result = 'column';
        else if (catalogId === 'TR-014')
            result = String(nodeParams.first_column_name || 'variable').trim() || 'variable';
        else if (catalogId === 'TR-022')
            result = null;
        else {
            const inherited = dataframeParents(nodeId).map((edge) => edgeId(edge, nextVisiting)).find(Boolean) || null;
            result = catalogId === 'CL-006' ? String(nodeParams.id_column || '').trim() || inherited : inherited;
        }
        idCache.set(nodeId, result);
        return result;
    };
    const resolveColumns = (nodeId: string, visiting = new Set<string>()): string[] => {
        const cached = columnsCache.get(nodeId);
        if (cached)
            return cached;
        if (visiting.has(nodeId))
            return [];
        const node = nodesById.get(nodeId);
        if (!node)
            return [];
        resolutionCount += 1;
        const catalogId = registryId(node);
        const nodeParams = params(node);
        const direct = datasetColumns(node);
        let result: string[];
        if (direct.length) {
            const idColumn = String(nodeParams.id_column || '').trim();
            result = unique([...(idColumn ? [idColumn] : []), ...direct.filter((column) => column !== idColumn)]);
        }
        else {
            const nextVisiting = new Set(visiting).add(nodeId);
            const parents = dataframeParents(nodeId);
            const parentColumns = unique(parents.flatMap((edge) => edgeColumns(edge, nextVisiting)));
            const inheritedId = parents.map((edge) => edgeId(edge, nextVisiting)).find(Boolean) || null;
            if (catalogId === 'CL-006') {
                const selected = parseColumnParam(nodeParams.columns);
                const idColumn = String(nodeParams.id_column || '').trim() || inheritedId;
                const calculationColumns = parentColumns.filter((column) => column !== inheritedId && column !== idColumn);
                const mode = String(nodeParams.mode || 'select');
                const active = mode === 'drop' && selected.length
                    ? calculationColumns.filter((column) => !selected.includes(column))
                    : mode !== 'drop' && selected.length
                        ? selected.filter((column) => calculationColumns.includes(column))
                        : calculationColumns;
                result = unique([...(idColumn ? [idColumn] : []), ...active]);
            }
            else if (catalogId === 'MP-002') {
                const target = String(nodeParams.target_column || '');
                const configured = parseColumnParam(nodeParams.columns);
                const features = (configured.length ? configured : parentColumns)
                    .filter((column) => column !== target && column !== inheritedId && parentColumns.includes(column));
                result = unique([...(inheritedId ? [inheritedId] : []), ...features, ...(target && parentColumns.includes(target) ? [target] : [])]);
            }
            else if (catalogId === 'TR-022') {
                result = unique([String(nodeParams.group_by || ''), ...parseColumnParam(nodeParams.columns)]).filter((column) => parentColumns.includes(column));
            }
            else if (catalogId === 'IN-008') {
                result = unique(['column', ...parseColumnParam(nodeParams.metrics)]);
            }
            else if (['TR-014', 'UT-001', 'DI-001'].includes(catalogId) || catalogId.startsWith('UC-') || catalogId.startsWith('COMP-')) {
                result = [];
            }
            else {
                result = inheritedId && parentColumns.includes(inheritedId)
                    ? unique([inheritedId, ...parentColumns.filter((column) => column !== inheritedId)])
                    : parentColumns;
            }
        }
        columnsCache.set(nodeId, result);
        return result;
    };
    return {
        inputContext(nodeId: string | null): ColumnContext {
            if (!nodeId)
                return EMPTY_CONTEXT;
            const node = nodesById.get(nodeId);
            if (!node)
                return EMPTY_CONTEXT;
            if (registryId(node) === 'DI-002') {
                const sourceColumns = datasetColumns(node);
                const idColumn = String(params(node).id_column || '').trim() || null;
                return { activeColumns: sourceColumns.filter((column) => column !== idColumn), sourceColumns, idColumn };
            }
            const parents = dataframeParents(nodeId);
            const columns = unique(parents.flatMap((edge) => edgeColumns(edge)));
            const sourceColumns = columns;
            const idColumn = parents.map((edge) => edgeId(edge)).find(Boolean) || null;
            return {
                activeColumns: columns.filter((column) => column !== idColumn),
                sourceColumns: sourceColumns.length ? sourceColumns : columns,
                idColumn,
            };
        },
        get resolutionCount() {
            return resolutionCount;
        },
    };
}
export function inputColumnContextForNode(nodeId: string | null, nodes: Node[], edges: Edge[], datasets: Dataset[], workflowDatasetId: number | null, aliases: LegacyNodeAliases): ColumnContext {
    return createColumnContextResolver(nodes, edges, datasets, workflowDatasetId, aliases).inputContext(nodeId);
}
export function inputColumnsForNode(nodeId: string | null, nodes: Node[], edges: Edge[], datasets: Dataset[], workflowDatasetId: number | null, aliases: LegacyNodeAliases) {
    return inputColumnContextForNode(nodeId, nodes, edges, datasets, workflowDatasetId, aliases).activeColumns;
}
