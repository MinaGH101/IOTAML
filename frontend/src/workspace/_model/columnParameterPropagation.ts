import type { Edge, Node } from '@xyflow/react';
import type { Dataset, NodeParam, RegistryNode } from '../../shared/types';
import { createColumnContextResolver } from './columnContext.ts';
import { isIdColumnParameter } from './parameterModel.ts';
import { resolveRegistryId, type LegacyNodeAliases } from './registryAliases.ts';

const COLUMN_BLOCK_TYPES = new Set(['replacement_blocks', 'imputation_blocks', 'normalization_blocks']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function dynamic(value: unknown) {
    return isRecord(value) && value.mode === 'dynamic';
}

function columnList(value: unknown) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value !== 'string') return [];
    const text = value.trim();
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    }
    catch {
        // Older drafts stored comma-separated column selections.
    }
    return text.split(',').map((item) => item.trim()).filter(Boolean);
}

function preserveColumnList(value: unknown, columns: string[]) {
    if (value === null) return null;
    return Array.isArray(value) ? columns : columns.join(',');
}

function sameValue(left: unknown, right: unknown) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function reconcileColumnBlocks(value: unknown, allowed: Set<string>) {
    if (!Array.isArray(value)) return value;
    return value.map((entry) => {
        if (!isRecord(entry)) return entry;
        const columns = columnList(entry.columns).filter((column) => allowed.has(column));
        return sameValue(columns, entry.columns) ? entry : { ...entry, columns: columns };
    });
}

function reconcileScatterBlocks(value: unknown, allowed: Set<string>) {
    if (!Array.isArray(value)) return value;
    return value.map((entry) => {
        if (!isRecord(entry)) return entry;
        const next = { ...entry };
        for (const key of ['x_column', 'y_column']) {
            if (String(next[key] || '').trim() && !allowed.has(String(next[key]))) next[key] = '';
        }
        return next;
    });
}

function reconcileParameters(params: Record<string, unknown>, schema: NodeParam[], activeColumns: string[], sourceColumns: string[]) {
    const active = new Set(activeColumns);
    const source = new Set(sourceColumns);
    let next = params;
    for (const setting of schema) {
        const value = params[setting.name];
        if (value === undefined || dynamic(value)) continue;
        let replacement: unknown = value;
        if (setting.type === 'column') {
            const allowed = isIdColumnParameter(setting.name) ? source : active;
            if (String(value || '').trim() && !allowed.has(String(value))) replacement = null;
        }
        else if (setting.type === 'columns') {
            replacement = preserveColumnList(value, columnList(value).filter((column) => active.has(column)));
        }
        else if (COLUMN_BLOCK_TYPES.has(setting.type)) {
            replacement = reconcileColumnBlocks(value, active);
        }
        else if (setting.type === 'scatter_blocks') {
            replacement = reconcileScatterBlocks(value, active);
        }
        if (!sameValue(value, replacement)) next = { ...next, [setting.name]: replacement };
    }
    return next;
}

function downstreamNodeIds(sourceId: string, edges: Edge[]) {
    const children = new Map<string, string[]>();
    edges.forEach((edge) => children.set(edge.source, [...(children.get(edge.source) || []), edge.target]));
    const descendants = new Set<string>();
    const pending = [...(children.get(sourceId) || [])];
    while (pending.length) {
        const nodeId = pending.pop()!;
        if (descendants.has(nodeId)) continue;
        descendants.add(nodeId);
        pending.push(...(children.get(nodeId) || []));
    }
    return descendants;
}

/**
 * Remove stale column references from the affected branch when an upstream
 * setting changes the frame schema.  This uses the same connected-port column
 * resolver as the editor, rather than a hand-maintained list of node types.
 */
export function updateParametersAndPropagateColumns({
    nodes, edges, nodeId, params, registry, aliases, datasets, workflowDatasetId,
}: {
    nodes: Node[];
    edges: Edge[];
    nodeId: string;
    params: Record<string, unknown>;
    registry: RegistryNode[];
    aliases: LegacyNodeAliases;
    datasets: Dataset[];
    workflowDatasetId: number | null;
}) {
    let result = nodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, params } } : node);
    const affected = downstreamNodeIds(nodeId, edges);
    if (!affected.size) return result;
    const definitions = new Map(registry.map((definition) => [definition.id, definition]));

    // A downstream Select Columns node can in turn change the columns seen by
    // its descendants, so repeat until the branch reaches a stable schema.
    for (let pass = 0; pass < affected.size; pass += 1) {
        const resolver = createColumnContextResolver(result, edges, datasets, workflowDatasetId, aliases);
        let changed = false;
        result = result.map((node) => {
            if (!affected.has(node.id)) return node;
            const registryId = resolveRegistryId(String(node.data.registryId || node.data.catalogId || ''), aliases);
            const definition = definitions.get(registryId);
            const schema = definition?.settingsSchema?.length ? definition.settingsSchema : definition?.params || [];
            if (!schema.length) return node;
            const current = isRecord(node.data.params) ? node.data.params : {};
            const context = resolver.inputContext(node.id);
            const next = reconcileParameters(current, schema, context.activeColumns, context.sourceColumns);
            if (next === current) return node;
            changed = true;
            return { ...node, data: { ...node.data, params: next } };
        });
        if (!changed) break;
    }
    return result;
}
