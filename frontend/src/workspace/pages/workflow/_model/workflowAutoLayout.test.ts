import assert from 'node:assert/strict';
import test from 'node:test';
import type { Edge, Node } from '@xyflow/react';
import { layoutWorkflowNodes } from './workflowAutoLayout.ts';

const nodes = [
  { id: 'source', position: { x: 0, y: 0 }, data: {} },
  { id: 'middle', position: { x: 0, y: 0 }, data: {} },
  { id: 'result', position: { x: 0, y: 0 }, data: {} },
] as Node[];
const edges = [
  { id: 'one', source: 'source', target: 'middle' },
  { id: 'two', source: 'middle', target: 'result' },
] as Edge[];

test('workflow layout orders connected nodes by graph depth', () => {
  const result = layoutWorkflowNodes(nodes, edges, {
    width: 1440,
    height: 900,
    paletteCollapsed: false,
    resultsCollapsed: false,
    resultsWidth: 380,
  });
  assert.ok(result[0].position.x < result[1].position.x);
  assert.ok(result[1].position.x < result[2].position.x);
  assert.ok(result.every((node) => Number.isFinite(node.position.y)));
});

test('workflow layout accounts for collapsed panels without hidden globals', () => {
  const result = layoutWorkflowNodes(nodes, edges, {
    width: 900,
    height: 600,
    paletteCollapsed: true,
    resultsCollapsed: true,
    resultsWidth: 380,
  });
  assert.equal(result.length, nodes.length);
  assert.ok(result[0].position.x >= 100);
});
