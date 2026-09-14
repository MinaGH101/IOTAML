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
test('ID choices and calculation columns come only from the connected output', () => {
    const resolver = createColumnContextResolver(nodes as never[], edges as never[], [dataset] as never[], 1, {});
    assert.deepEqual(resolver.inputContext('next'), {
        activeColumns: ['Au'],
        sourceColumns: ['batch_id', 'Au'],
        idColumn: 'batch_id',
    });
});

test('runtime columns propagate through the connected branch, including derived columns', () => {
    const outputs = [{ node_id: 'select', source_handle: 'dataframe', kind: 'table', columns: ['derived'], active_columns: ['derived'], source_columns: ['Au', 'Cu'] }];
    const resolver = createColumnContextResolver(nodes as never[], edges as never[], [dataset] as never[], 1, {}, outputs);
    assert.deepEqual(resolver.inputContext('next').activeColumns, ['derived']);
    assert.deepEqual(resolver.inputContext('next').sourceColumns, ['derived']);
});

test('multiple parents contribute only their connected ports, and unrelated nodes contribute nothing', () => {
    const graphNodes = [...nodes, { id: 'second', data: { outputs: [{ id: 'data', type: 'dataframe' }, { id: 'report', type: 'json' }] } }];
    const graphEdges = [...edges, { id: 'e3', source: 'second', sourceHandle: 'data', target: 'next', targetHandle: 'right' }];
    const outputs = [
        { node_id: 'select', source_handle: 'dataframe', active_columns: ['Au'], source_columns: ['secret'], kind: 'table' },
        { node_id: 'second', source_handle: 'data', active_columns: ['derived'], kind: 'table' },
        { node_id: 'second', source_handle: 'report', active_columns: ['report_only'], kind: 'table' },
        { node_id: 'unrelated', active_columns: ['unrelated'], kind: 'table' },
    ];
    const resolver = createColumnContextResolver(graphNodes as never[], graphEdges as never[], [dataset] as never[], 1, {}, outputs);
    assert.deepEqual(resolver.inputContext('next').activeColumns, ['Au', 'derived']);
});

test('missing or disconnected ports never expose the source table', () => {
    const invalid = [{ ...edges[1], sourceHandle: 'missing' }];
    const resolver = createColumnContextResolver(nodes as never[], invalid as never[], [dataset] as never[], 1, {});
    assert.deepEqual(resolver.inputContext('next').activeColumns, []);
    assert.deepEqual(resolver.inputContext('select').activeColumns, []);
});
test('graph traversal is memoized within one resolver pass', () => {
    const resolver = createColumnContextResolver(nodes as never[], edges as never[], [dataset] as never[], 1, {});
    resolver.inputContext('next');
    const firstCount = resolver.resolutionCount;
    resolver.inputContext('next');
    assert.equal(resolver.resolutionCount, firstCount);
    assert.ok(firstCount <= nodes.length * 3);
});
