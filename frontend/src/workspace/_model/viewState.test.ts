import assert from 'node:assert/strict';
import test from 'node:test';
import { initialWorkflowViewState, workflowViewReducer } from './viewState.ts';

test('panel and board transitions only update view state', () => {
  const workflowData = {
    nodes: [{ id: 'source', data: { params: { id_column: 'sample_id' } } }],
    edges: [{ id: 'edge', source: 'source', target: 'select' }],
  };
  const snapshot = structuredClone(workflowData);

  let view = workflowViewReducer(initialWorkflowViewState, { type: 'results', value: true });
  view = workflowViewReducer(view, { type: 'analysis-board', value: (current) => !current });

  assert.equal(view.resultsCollapsed, true);
  assert.equal(view.analysisBoardOpen, true);
  assert.deepEqual(workflowData, snapshot);
});

test('functional panel updates are evaluated against their own field', () => {
  const collapsed = { ...initialWorkflowViewState, paletteCollapsed: true };
  const updated = workflowViewReducer(collapsed, { type: 'palette', value: (value) => !value });
  assert.equal(updated.paletteCollapsed, false);
  assert.equal(updated.resultsCollapsed, false);
});
