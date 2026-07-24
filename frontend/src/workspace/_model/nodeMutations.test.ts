import assert from 'node:assert/strict';
import test from 'node:test';
import type { Node } from '@xyflow/react';
import { renameWorkflowNode, updateNodeParameters } from './nodeMutations.ts';

const nodes = [
  { id: 'a', position: { x: 0, y: 0 }, data: { label: 'Old', params: { value: 1 } } },
  { id: 'b', position: { x: 0, y: 0 }, data: { label: 'Other' } },
] as Node[];

test('renaming changes only the requested node and preserves its parameters', () => {
  const renamed = renameWorkflowNode(nodes, 'a', 'New name');
  assert.equal(renamed[0].data.label, 'New name');
  assert.deepEqual(renamed[0].data.params, { value: 1 });
  assert.equal(renamed[1], nodes[1]);
  assert.equal(nodes[0].data.label, 'Old');
});

test('parameter updates preserve label and do not mutate the graph snapshot', () => {
  const updated = updateNodeParameters(nodes, 'a', { value: 2 });
  assert.equal(updated[0].data.label, 'Old');
  assert.deepEqual(updated[0].data.params, { value: 2 });
  assert.deepEqual(nodes[0].data.params, { value: 1 });
});
