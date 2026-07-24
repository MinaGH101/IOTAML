import assert from 'node:assert/strict';
import test from 'node:test';
import { createColumnContextResolver } from './columnContext.ts';

const dataset = {
  id: 1,
  name: 'samples',
  columns: ['sample_id', 'batch_id', 'Au', 'Cu'].map((name) => ({ name })),
};
const nodes = [
  {
    id: 'input',
    data: {
      registryId: 'DI-002',
      params: { dataset_id: 1, id_column: 'sample_id' },
      outputs: [{ id: 'dataframe', type: 'dataframe' }],
    },
  },
  {
    id: 'select',
    data: {
      registryId: 'CL-006',
      params: { mode: 'select', columns: ['Au'], id_column: 'batch_id' },
      outputs: [{ id: 'dataframe', type: 'dataframe' }],
    },
  },
  { id: 'next', data: { registryId: 'TR-020', params: {}, outputs: [{ id: 'dataframe', type: 'dataframe' }] } },
];
const edges = [
  { id: 'e1', source: 'input', sourceHandle: 'dataframe', target: 'select', targetHandle: 'data' },
  { id: 'e2', source: 'select', sourceHandle: 'dataframe', target: 'next', targetHandle: 'data' },
];

test('ID switching keeps original ID options and excludes ID from calculations', () => {
  const resolver = createColumnContextResolver(nodes as never[], edges as never[], [dataset] as never[], 1, {});
  assert.deepEqual(resolver.inputContext('next'), {
    activeColumns: ['Au'],
    sourceColumns: ['sample_id', 'batch_id', 'Au', 'Cu'],
    idColumn: 'batch_id',
  });
});

test('graph traversal is memoized within one resolver pass', () => {
  const resolver = createColumnContextResolver(nodes as never[], edges as never[], [dataset] as never[], 1, {});
  resolver.inputContext('next');
  const firstCount = resolver.resolutionCount;
  resolver.inputContext('next');
  assert.equal(resolver.resolutionCount, firstCount);
  assert.ok(firstCount <= nodes.length * 3);
});
