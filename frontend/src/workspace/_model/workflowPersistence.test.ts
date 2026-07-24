import assert from 'node:assert/strict';
import test from 'node:test';
import type { Edge, Node } from '@xyflow/react';
import { createAutosaveSignature } from './workflowPersistence.ts';

const base = {
  name: ' Workflow ',
  projectId: 1,
  lastRunId: null,
  nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { params: { value: 1 } } }] as Node[],
  edges: [] as Edge[],
  datasetId: 2,
  targetColumn: 'target',
  taskType: 'auto',
  activeBoardId: 'main',
  analysisBoards: [],
};

test('autosave signature ignores object identity but detects graph changes', () => {
  const first = createAutosaveSignature(base);
  const equivalent = createAutosaveSignature(structuredClone(base));
  const changed = createAutosaveSignature({
    ...base,
    nodes: [{ ...base.nodes[0], data: { params: { value: 2 } } }] as Node[],
  });
  assert.equal(first, equivalent);
  assert.notEqual(first, changed);
});
