import assert from 'node:assert/strict';
import test from 'node:test';
import { dataframeContextFromOutputs, outputsForIncomingEdge } from './runtimeContext.ts';

test('runtime dataframe metadata overrides bounded preview columns', () => {
  const context = dataframeContextFromOutputs([{
    node_id: 'select',
    kind: 'table',
    columns: ['batch_id', 'Au'],
    active_columns: ['Au'],
    source_columns: ['sample_id', 'batch_id', 'Au', 'Cu'],
    id_column: 'batch_id',
    rows: [],
  }] as never[]);
  assert.deepEqual(context, {
    activeColumns: ['Au'],
    sourceColumns: ['sample_id', 'batch_id', 'Au', 'Cu'],
    idColumn: 'batch_id',
  });
});

test('multi-output selection uses the connected source handle', () => {
  const nodes = new Map([['node', {
    id: 'node',
    data: { outputs: [{ id: 'dataframe' }, { id: 'report' }] },
  }]]);
  const outputs = [
    { node_id: 'node', source_handle: 'dataframe', kind: 'table' },
    { node_id: 'node', source_handle: 'report', kind: 'table' },
  ];
  const selected = outputsForIncomingEdge(outputs as never[], {
    id: 'edge',
    source: 'node',
    sourceHandle: 'report',
    target: 'next',
  } as never, nodes as never);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].source_handle, 'report');
});
