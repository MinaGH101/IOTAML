import type { Edge, Node } from '@xyflow/react';
import type { Output } from './output';
import type { ComponentVersion, Run, RunProgressSnapshot, RunSummary } from '../../shared/types';
export function runToSummary(run: Run): RunSummary {
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
export function upsertRunSummary(items: RunSummary[], run: Run) {
    return [runToSummary(run), ...items.filter((item) => item.id !== run.id)].slice(0, 50);
}
export function retainRunDisplayState(previous: Run | null, next: Run): Run {
    if (!previous || previous.workflow_id !== next.workflow_id || next.status === 'succeeded')
        return next;
    const previousOutputs = (previous.artifacts?.node_outputs || {}) as Record<string, unknown>;
    const nextOutputs = (next.artifacts?.node_outputs || {}) as Record<string, unknown>;
    return {
        ...next,
        node_statuses: { ...(previous.node_statuses || {}), ...(next.node_statuses || {}) },
        artifacts: {
            ...(previous.artifacts || {}),
            ...(next.artifacts || {}),
            node_outputs: { ...previousOutputs, ...nextOutputs },
        },
    };
}
function runNodeIds(run: Run, key: 'executed_node_ids' | 'invalidated_node_ids') {
    const executionState = run.artifacts?.execution_state as Record<string, unknown> | undefined;
    const values = executionState?.[key];
    if (Array.isArray(values))
        return values.map(String);
    if (key === 'executed_node_ids') {
        const executionPlan = run.artifacts?.execution_plan as Record<string, unknown> | undefined;
        const order = executionPlan?.order;
        if (Array.isArray(order))
            return order.map(String);
    }
    return [];
}
/**
 * Keep the latest valid result for every node independently from the currently
 * selected/active run. A successful partial run replaces only nodes that were
 * executed and removes only nodes explicitly invalidated by dependency changes.
 */
export function mergePersistentNodeState(previous: Run | null, completed: Run): Run {
    if (completed.status !== 'succeeded')
        return previous || completed;
    if (!previous || previous.workflow_id !== completed.workflow_id)
        return completed;
    const previousOutputs = {
        ...((previous.artifacts?.node_outputs || {}) as Record<string, unknown>),
    };
    const previousStatuses = { ...(previous.node_statuses || {}) };
    const completedOutputs = {
        ...((completed.artifacts?.node_outputs || {}) as Record<string, unknown>),
    };
    const completedStatuses = { ...(completed.node_statuses || {}) };
    const executed = new Set(runNodeIds(completed, 'executed_node_ids'));
    const invalidated = new Set(runNodeIds(completed, 'invalidated_node_ids'));
    // The rerun node(s) no longer own their previous result. They will be
    // replaced below by the successful result returned by this run.
    executed.forEach((nodeId) => {
        delete previousOutputs[nodeId];
        delete previousStatuses[nodeId];
    });
    invalidated.forEach((nodeId) => {
        delete previousOutputs[nodeId];
        delete previousStatuses[nodeId];
    });
    Object.entries(completedOutputs).forEach(([nodeId, output]) => {
        if (!invalidated.has(nodeId))
            previousOutputs[nodeId] = output;
    });
    Object.entries(completedStatuses).forEach(([nodeId, status]) => {
        if (!invalidated.has(nodeId))
            previousStatuses[nodeId] = status;
    });
    return {
        ...completed,
        node_statuses: previousStatuses,
        artifacts: {
            ...(previous.artifacts || {}),
            ...(completed.artifacts || {}),
            node_outputs: previousOutputs,
        },
    };
}
export function outputsForIncomingEdge(outputs: Output[], edge: Edge, nodesById: ReadonlyMap<string, Node>) {
    const candidates = outputs.filter((item) => String(item.node_id || '') === edge.source);
    if (!candidates.length)
        return [] as Output[];
    const selectedHandle = String(edge.sourceHandle || '');
    const annotated = candidates.filter((item) => String(item.source_handle || '').trim());
    if (selectedHandle) {
        const exact = candidates.filter((item) => String(item.source_handle || '') === selectedHandle);
        if (exact.length)
            return exact;
        if (annotated.length)
            return [];
    }
    const ports = (nodesById.get(edge.source)?.data?.outputs || []) as Array<{
        id?: string;
    }>;
    if (ports.length <= 1)
        return candidates;
    if (annotated.length === 0)
        return []; // Legacy multi-port previews are ambiguous; rerun the source.
    const fallbackHandle = String(ports[0]?.id || '');
    return candidates.filter((item) => String(item.source_handle || '') === fallbackHandle);
}
function columnsFromOutputs(outputs: Output[]) {
    for (let index = outputs.length - 1; index >= 0; index -= 1) {
        const columns = outputs[index]?.columns;
        if (Array.isArray(columns))
            return columns.map(String);
        const rows = outputs[index]?.rows;
        if (Array.isArray(rows) && rows.length && rows[0] && typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
            return Object.keys(rows[0] as Record<string, unknown>);
        }
    }
    return [] as string[];
}
export function dataframeContextFromOutputs(outputs: Output[]) {
    for (let index = outputs.length - 1; index >= 0; index -= 1) {
        const output = outputs[index];
        const activeColumns = Array.isArray(output?.active_columns) ? output.active_columns.map(String) : null;
        const sourceColumns = Array.isArray(output?.source_columns) ? output.source_columns.map(String) : null;
        const idColumn = String(output?.id_column || '').trim() || null;
        if (activeColumns || sourceColumns || idColumn) {
            const visibleColumns = columnsFromOutputs([output]);
            return {
                activeColumns: activeColumns || visibleColumns.filter((column) => column !== idColumn),
                sourceColumns: [...new Set([...(idColumn ? [idColumn] : []), ...(activeColumns || visibleColumns)])],
                idColumn,
            };
        }
    }
    return null;
}
export function rowsFromOutputs(outputs: Output[]) {
    for (let index = outputs.length - 1; index >= 0; index -= 1) {
        const rows = outputs[index]?.rows;
        if (Array.isArray(rows) && rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
            return rows as Record<string, unknown>[];
        }
    }
    return [] as Record<string, unknown>[];
}
export function mergeRunProgress(run: Run, snapshot: RunProgressSnapshot): Run {
    const currentProgress = run.progress || {};
    const nextProgress = snapshot.progress || {};
    const progressUnchanged = currentProgress.updated_at === nextProgress.updated_at
        && currentProgress.percent === nextProgress.percent
        && currentProgress.nodes_finished === nextProgress.nodes_finished
        && currentProgress.nodes_total === nextProgress.nodes_total
        && currentProgress.current_node_id === nextProgress.current_node_id;
    const mergedNodeStatuses = { ...(run.node_statuses || {}), ...(snapshot.node_statuses || {}) };
    const nodesUnchanged = JSON.stringify(run.node_statuses || {}) === JSON.stringify(mergedNodeStatuses);
    if (run.status === snapshot.status
        && run.attempts === snapshot.attempts
        && run.max_attempts === snapshot.max_attempts
        && run.cancel_requested === snapshot.cancel_requested
        && run.heartbeat_at === snapshot.heartbeat_at
        && run.started_at === snapshot.started_at
        && run.finished_at === snapshot.finished_at
        && run.error === snapshot.error
        && progressUnchanged
        && nodesUnchanged)
        return run;
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
        node_statuses: mergedNodeStatuses,
    };
}
export function componentDraftSignature(nodes: Node[], edges: Edge[], version: Pick<ComponentVersion, 'interface_json' | 'exposed_parameters'>) {
    return JSON.stringify({
        nodes: nodes.map((node) => ({ ...node, selected: false, dragging: false })),
        edges: edges.map((edge) => ({ ...edge, selected: false })),
        interface: version.interface_json,
        exposed: version.exposed_parameters,
    });
}
