import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBoardItems } from './boardOutputs.ts';
import type { AnalysisBoardItem } from './board.ts';

const item: AnalysisBoardItem = {
  id: 'pin-1',
  nodeId: 'node-1',
  outputIndex: 0,
  outputTitle: 'Distribution',
  outputKind: 'plot',
  x: 0,
  y: 0,
  w: 300,
  h: 220,
  runId: 1,
  snapshot: { kind: 'plot', title: 'Distribution', node_id: 'node-1', value: 'old' },
  createdAt: '2026-01-01T00:00:00Z',
};

test('board keeps the snapshot while workflow settings are dirty', () => {
  const [resolved] = resolveBoardItems(
    [item],
    [{ kind: 'plot', title: 'Distribution', node_id: 'node-1', value: 'new' }],
    true,
  );
  assert.equal(resolved.output?.value, 'old');
  assert.equal(resolved.stale, true);
});

test('board uses current run output after a successful rerun', () => {
  const [resolved] = resolveBoardItems(
    [item],
    [{ kind: 'plot', title: 'Distribution', node_id: 'node-1', value: 'new' }],
    false,
  );
  assert.equal(resolved.output?.value, 'new');
  assert.equal(resolved.stale, false);
});
