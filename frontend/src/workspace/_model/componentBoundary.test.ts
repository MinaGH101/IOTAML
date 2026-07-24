import assert from 'node:assert/strict';
import test from 'node:test';
import type { Edge, Node } from '@xyflow/react';
import { analyzeComponentBoundary } from './componentBoundary.ts';

const nodes = [
  { id: 'outside', position: { x: 0, y: 0 }, data: { outputs: [{ id: 'out', type: 'dataframe' }] } },
  { id: 'a', position: { x: 0, y: 0 }, data: { inputs: [{ id: 'in', type: 'dataframe' }], outputs: [{ id: 'out', type: 'dataframe' }] } },
  { id: 'b', position: { x: 0, y: 0 }, data: { inputs: [{ id: 'in', type: 'dataframe' }], outputs: [{ id: 'out', type: 'plot' }] } },
  { id: 'consumer', position: { x: 0, y: 0 }, data: { inputs: [{ id: 'in', type: 'plot' }] } },
] as Node[];

const edges = [
  { id: 'incoming', source: 'outside', target: 'a', sourceHandle: 'out', targetHandle: 'in' },
  { id: 'internal', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' },
  { id: 'outgoing', source: 'b', target: 'consumer', sourceHandle: 'out', targetHandle: 'in' },
] as Edge[];

test('component boundary exposes only external connections', () => {
  const boundary = analyzeComponentBoundary(nodes, edges, ['a', 'b']);
  assert.ok(boundary);
  assert.equal(boundary.disconnected, false);
  assert.equal(boundary.inputs[0].type, 'dataframe');
  assert.equal(boundary.inputs[0].internal_node_id, 'a');
  assert.equal(boundary.outputs[0].type, 'plot');
  assert.equal(boundary.outputs[0].internal_node_id, 'b');
});

test('component boundary rejects disconnected selections', () => {
  const boundary = analyzeComponentBoundary(nodes, edges, ['a', 'consumer']);
  assert.equal(boundary?.disconnected, true);
});
