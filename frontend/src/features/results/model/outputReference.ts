import type { Output } from '../../../workspace/_model/output';

export type OutputReference = {
  runId: number | null;
  nodeId: string;
  outputId: string;
  artifactId?: number;
  revision?: string;
};

function optionalNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function optionalString(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return text || undefined;
}

export function createOutputReference(
  output: Output,
  runId: number | null,
  nodeIdFallback: string | null,
  outputIdFallback: string,
): OutputReference {
  const nodeId = optionalString(output.node_id) || optionalString(nodeIdFallback) || '';
  const outputId = optionalString(output.output_id)
    || optionalString(output.id)
    || outputIdFallback;
  const artifactId = optionalNumber(output.artifact_id);
  const revision = optionalString(output.revision ?? output.output_revision ?? output.artifact_revision);
  return {
    runId,
    nodeId,
    outputId,
    ...(artifactId ? { artifactId } : {}),
    ...(revision ? { revision } : {}),
  };
}

export function restoreOutputReference(value: unknown): OutputReference | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Partial<OutputReference>;
  const nodeId = optionalString(candidate.nodeId);
  const outputId = optionalString(candidate.outputId);
  if (!nodeId || !outputId) return undefined;
  const runIdValue = candidate.runId === null ? null : Number(candidate.runId);
  const runId = runIdValue === null || Number.isFinite(runIdValue) ? runIdValue : null;
  const artifactId = optionalNumber(candidate.artifactId);
  const revision = optionalString(candidate.revision);
  return {
    runId,
    nodeId,
    outputId,
    ...(artifactId ? { artifactId } : {}),
    ...(revision ? { revision } : {}),
  };
}
