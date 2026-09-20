import assert from 'node:assert/strict';
import test from 'node:test';
import type { Edge, Node } from '@xyflow/react';
import type { RegistryNode } from '../../shared/types';
import { updateParametersAndPropagateColumns } from './columnParameterPropagation.ts';

const registry = [
    { id: 'DI-002', settingsSchema: [], params: [] },
    { id: 'CL-006', settingsSchema: [{ name: 'columns', type: 'columns' }], params: [] },
    {
        id: 'next',
        settingsSchema: [
            { name: 'columns', type: 'columns' },
            { name: 'target_column', type: 'column' },
        ],
        params: [],
    },
] as unknown as RegistryNode[];

const nodes = [
    { id: 'input', position: { x: 0, y: 0 }, data: { registryId: 'DI-002', params: { dataset_id: 1, id_column: 'id' }, outputs: [{ id: 'dataframe', type: 'dataframe' }] } },
    { id: 'select', position: { x: 0, y: 0 }, data: { registryId: 'CL-006', params: { mode: 'select', columns: ['a', 'b'] }, outputs: [{ id: 'dataframe', type: 'dataframe' }] } },
    { id: 'next', position: { x: 0, y: 0 }, data: { registryId: 'next', params: { columns: ['b'], target_column: 'b' } } },
] as Node[];

const edges = [
    { id: 'input-select', source: 'input', sourceHandle: 'dataframe', target: 'select', targetHandle: 'data' },
    { id: 'select-next', source: 'select', sourceHandle: 'dataframe', target: 'next', targetHandle: 'data' },
] as Edge[];

test('removing an upstream column clears stale downstream column settings', () => {
    const updated = updateParametersAndPropagateColumns({
        nodes,
        edges,
        nodeId: 'select',
        params: { mode: 'select', columns: ['a'] },
        registry,
        aliases: {},
        datasets: [{ id: 1, name: 'source', columns: [{ name: 'id' }, { name: 'a' }, { name: 'b' }] }] as never[],
        workflowDatasetId: 1,
    });
    const downstream = updated.find((node) => node.id === 'next')!;
    assert.deepEqual(downstream.data.params, { columns: [], target_column: null });
    assert.deepEqual(nodes[2].data.params, { columns: ['b'], target_column: 'b' });
});
