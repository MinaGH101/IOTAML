import type { AnalysisBoardItem } from './board';
import type { Output } from './output';

export function boardOutputTitle(output: Output, index: number) {
  const base = String(output.title || `خروجی ${index + 1}`);
  const source = String(output.source_label || output.branch || '').trim();
  return source ? `${base} · ${source}` : base;
}

export function boardOutputKey(output: Output) {
  return [
    output.node_id || '',
    output.title || '',
    output.kind || '',
    output.source_label || '',
    output.branch || '',
    output.path_index || '',
  ].map(String).join('::');
}

export function buildBoardOutputLookup(outputs: Output[]) {
  const byNode = new Map<string, Output[]>();
  outputs.forEach((output) => {
    const nodeId = String(output.node_id || '');
    const values = byNode.get(nodeId) || [];
    values.push(output);
    if (Array.isArray(output.plots)) values.push(...(output.plots as Output[]));
    byNode.set(nodeId, values);
  });
  return byNode;
}

export function findCurrentBoardOutput(
  item: AnalysisBoardItem,
  lookup: Map<string, Output[]>,
) {
  const searchable = lookup.get(String(item.nodeId || '')) || [];
  const exact = searchable.find(
    (output) => String(output.title || '') === item.outputTitle
      || boardOutputTitle(output, item.outputIndex) === item.outputTitle,
  );
  if (exact) return exact;
  const sameKind = searchable.filter(
    (output) => String(output.kind || 'json') === item.outputKind,
  );
  return sameKind[item.outputIndex] || searchable[item.outputIndex] || null;
}

export function resolveBoardItems(
  items: AnalysisBoardItem[],
  outputs: Output[],
  workflowDirty: boolean,
) {
  const lookup = buildBoardOutputLookup(outputs);
  return items.map((item) => {
    const currentOutput = findCurrentBoardOutput(item, lookup);
    return {
      item,
      currentOutput,
      output: workflowDirty ? (item.snapshot || currentOutput) : (currentOutput || item.snapshot),
      stale: workflowDirty || !currentOutput,
    };
  });
}
