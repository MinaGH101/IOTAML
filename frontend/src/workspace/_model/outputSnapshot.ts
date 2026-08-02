import type { Output } from './output';

const LIMITS = {
  objectKeys: 200,
  rows: 250,
  points: 1_200,
  plots: 60,
  seriesValues: 2_000,
  matrixAxis: 250,
  stringLength: 50_000,
  depth: 6,
} as const;

const ROW_ARRAY_KEYS = new Set(['rows', 'records']);
const POINT_ARRAY_KEYS = new Set(['points', 'data']);
const PLOT_ARRAY_KEYS = new Set(['plots']);
const SERIES_ARRAY_KEYS = new Set([
  'ranks',
  'original_values',
  'corrected_values',
  'outlier_flags',
  'values',
  'predictions',
  'actual',
  'expected',
  'observed',
]);
const MATRIX_ARRAY_KEYS = new Set(['matrix', 'z', 'values_2d']);

type SnapshotContext = {
  truncated: boolean;
};

function arrayLimit(key: string | null) {
  if (key && ROW_ARRAY_KEYS.has(key)) return LIMITS.rows;
  if (key && POINT_ARRAY_KEYS.has(key)) return LIMITS.points;
  if (key && PLOT_ARRAY_KEYS.has(key)) return LIMITS.plots;
  if (key && SERIES_ARRAY_KEYS.has(key)) return LIMITS.seriesValues;
  if (key && MATRIX_ARRAY_KEYS.has(key)) return LIMITS.matrixAxis;
  return LIMITS.seriesValues;
}

function boundedValue(
  value: unknown,
  key: string | null,
  depth: number,
  context: SnapshotContext,
): unknown {
  if (depth > LIMITS.depth) {
    context.truncated = true;
    return null;
  }
  if (typeof value === 'string' && value.length > LIMITS.stringLength) {
    context.truncated = true;
    return `${value.slice(0, LIMITS.stringLength)}…`;
  }
  if (Array.isArray(value)) {
    const limit = arrayLimit(key);
    if (value.length > limit) context.truncated = true;
    return value.slice(0, limit).map((item) => (
      boundedValue(item, null, depth + 1, context)
    ));
  }
  if (!value || typeof value !== 'object') return value;

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > LIMITS.objectKeys) context.truncated = true;
  return Object.fromEntries(
    entries
      .slice(0, LIMITS.objectKeys)
      .filter(([childKey]) => childKey !== 'snapshot')
      .map(([childKey, childValue]) => [
        childKey,
        boundedValue(childValue, childKey, depth + 1, context),
      ]),
  );
}

export function createOutputSnapshot(output: Output | undefined): Output | undefined {
  if (!output) return undefined;
  const context: SnapshotContext = { truncated: false };
  const snapshot = boundedValue(output, null, 0, context) as Output;
  if (context.truncated) snapshot.snapshot_truncated = true;
  return snapshot;
}
