import assert from 'node:assert/strict';
import test from 'node:test';
import { createOutputReference, restoreOutputReference } from './outputReference.ts';

test('creates a stable output reference without copying output data', () => {
  const reference = createOutputReference({
    node_id: 'node-1',
    output_id: 'table-main',
    artifact_id: 42,
    rows: Array.from({ length: 500 }, (_, index) => ({ index })),
  }, 8, null, 'fallback');
  assert.deepEqual(reference, {
    runId: 8,
    nodeId: 'node-1',
    outputId: 'table-main',
    artifactId: 42,
  });
  assert.equal('rows' in reference, false);
});

test('rejects malformed persisted references', () => {
  assert.equal(restoreOutputReference({ nodeId: 'node-1' }), undefined);
  assert.deepEqual(restoreOutputReference({ runId: 3, nodeId: 'node-1', outputId: 'main' }), {
    runId: 3,
    nodeId: 'node-1',
    outputId: 'main',
  });
});
