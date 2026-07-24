import type { Edge, Node } from '@xyflow/react';
import type { Output } from './output';
import type { ComponentVersion, Run, RunProgressSnapshot, RunSummary } from '../../shared/_types';

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

export function outputsForIncomingEdge(outputs: Output[], edge: Edge, nodesById: ReadonlyMap<string, Node>) {
  const candidates = outputs.filter((item) => String(item.node_id || '') === edge.source);
  if (!candidates.length) return [] as Output[];
  const selectedHandle = String(edge.sourceHandle || '');
  const annotated = candidates.filter((item) => String(item.source_handle || '').trim());
  if (selectedHandle) {
    const exact = candidates.filter((item) => String(item.source_handle || '') === selectedHandle);
    if (exact.length) return exact;
    if (annotated.length) return [];
  }
  const ports = (nodesById.get(edge.source)?.data?.outputs || []) as Array<{ id?: string }>;
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
        sourceColumns: sourceColumns || visibleColumns,
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

export function componentDraftSignature(
  nodes: Node[],
  edges: Edge[],
  version: Pick<ComponentVersion, 'interface_json' | 'exposed_parameters'>,
) {
  return JSON.stringify({
    nodes: nodes.map((node) => ({ ...node, selected: false, dragging: false })),
    edges: edges.map((edge) => ({ ...edge, selected: false })),
    interface: version.interface_json,
    exposed: version.exposed_parameters,
  });
}
