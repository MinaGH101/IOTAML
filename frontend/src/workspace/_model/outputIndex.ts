import type { Run } from '../../shared/_types';
import type { Output } from './output';

export type OutputIndex = {
  all: Output[];
  byNode: Map<string, Output[]>;
};

const EMPTY_OUTPUT_INDEX: OutputIndex = {
  all: [],
  byNode: new Map(),
};
const indexByNodeOutputs = new WeakMap<object, OutputIndex>();

function isOutput(value: unknown): value is Output {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function buildOutputIndex(raw: unknown): OutputIndex {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY_OUTPUT_INDEX;
  const existing = indexByNodeOutputs.get(raw);
  if (existing) return existing;

  const all = Object.values(raw as Record<string, Output | Output[]>)
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter(isOutput);
  const byNode = new Map<string, Output[]>();
  all.forEach((output) => {
    const nodeId = String(output.node_id || '');
    const outputs = byNode.get(nodeId);
    if (outputs) outputs.push(output);
    else byNode.set(nodeId, [output]);
  });

  const index = { all, byNode };
  indexByNodeOutputs.set(raw, index);
  return index;
}

export function outputIndexForRun(run: Run | null): OutputIndex {
  const raw = run?.artifacts?.node_outputs;
  return buildOutputIndex(raw);
}

export function outputsForNode(run: Run | null, nodeId: string | null): Output[] {
  const index = outputIndexForRun(run);
  return nodeId ? index.byNode.get(nodeId) || EMPTY_OUTPUT_INDEX.all : index.all;
}
