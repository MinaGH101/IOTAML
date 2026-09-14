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
        sourceColumns: ['batch_id', 'Au'],
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
test('queued partial run keeps unaffected and previous visible outputs', async () => {
    const { retainRunDisplayState } = await import('./runtimeContext.ts');
    const previous = {
        id: 1,
        workflow_id: 7,
        status: 'succeeded',
        node_statuses: { a: { status: 'succeeded' }, x: { status: 'succeeded' } },
        artifacts: { node_outputs: { a: { node_id: 'a' }, x: { node_id: 'x' } } },
    } as never;
    const queued = {
        id: 2,
        workflow_id: 7,
        status: 'queued',
        node_statuses: { a: { status: 'queued' } },
        artifacts: null,
    } as never;
    const merged = retainRunDisplayState(previous, queued);
    assert.deepEqual(Object.keys(merged.artifacts?.node_outputs || {}).sort(), ['a', 'x']);
    assert.equal(merged.node_statuses?.x.status, 'succeeded');
    assert.equal(merged.node_statuses?.a.status, 'queued');
});
test('successful run uses the server-composed workflow state', async () => {
    const { retainRunDisplayState } = await import('./runtimeContext.ts');
    const previous = {
        id: 1,
        workflow_id: 7,
        status: 'succeeded',
        node_statuses: { a: { status: 'succeeded' }, x: { status: 'succeeded' } },
        artifacts: { node_outputs: { a: { node_id: 'a', value: 1 }, x: { node_id: 'x', value: 9 } } },
    } as never;
    const completed = {
        id: 2,
        workflow_id: 7,
        status: 'succeeded',
        node_statuses: { a: { status: 'succeeded' } },
        artifacts: { node_outputs: { a: { node_id: 'a', value: 2 } } },
    } as never;
    const merged = retainRunDisplayState(previous, completed);
    assert.deepEqual((merged.artifacts?.node_outputs as Record<string, {
        value: number;
    }>).a.value, 2);
    assert.equal((merged.artifacts?.node_outputs as Record<string, {
        value: number;
    }>).x, undefined);
});
test('persistent node state keeps unrelated node results across successful partial runs', async () => {
    const { mergePersistentNodeState } = await import('./runtimeContext.ts');
    const first = {
        id: 1,
        workflow_id: 7,
        status: 'succeeded',
        node_statuses: { a: { status: 'succeeded' } },
        artifacts: {
            node_outputs: { a: { node_id: 'a', value: 1 } },
            execution_plan: { order: ['a'] },
        },
    } as never;
    const second = {
        id: 2,
        workflow_id: 7,
        status: 'succeeded',
        node_statuses: { x: { status: 'succeeded' } },
        artifacts: {
            node_outputs: { x: { node_id: 'x', value: 9 } },
            execution_state: {
                executed_node_ids: ['x'],
                invalidated_node_ids: [],
            },
        },
    } as never;
    const merged = mergePersistentNodeState(first, second);
    const outputs = merged.artifacts?.node_outputs as Record<string, {
        value: number;
    }>;
    assert.deepEqual(Object.keys(outputs).sort(), ['a', 'x']);
    assert.equal(outputs.a.value, 1);
    assert.equal(outputs.x.value, 9);
    assert.equal(merged.node_statuses?.a.status, 'succeeded');
    assert.equal(merged.node_statuses?.x.status, 'succeeded');
});
test('persistent node state removes only explicitly invalidated downstream nodes', async () => {
    const { mergePersistentNodeState } = await import('./runtimeContext.ts');
    const previous = {
        id: 1,
        workflow_id: 7,
        status: 'succeeded',
        node_statuses: {
            a: { status: 'succeeded' },
            b: { status: 'succeeded' },
            c: { status: 'succeeded' },
            x: { status: 'succeeded' },
        },
        artifacts: {
            node_outputs: {
                a: { node_id: 'a', value: 1 },
                b: { node_id: 'b', value: 2 },
                c: { node_id: 'c', value: 3 },
                x: { node_id: 'x', value: 9 },
            },
        },
    } as never;
    const completed = {
        id: 2,
        workflow_id: 7,
        status: 'succeeded',
        node_statuses: {
            a: { status: 'cached' },
            b: { status: 'succeeded' },
        },
        artifacts: {
            node_outputs: {
                a: { node_id: 'a', value: 1 },
                b: { node_id: 'b', value: 20 },
            },
            execution_state: {
                executed_node_ids: ['a', 'b'],
                invalidated_node_ids: ['c'],
            },
        },
    } as never;
    const merged = mergePersistentNodeState(previous, completed);
    const outputs = merged.artifacts?.node_outputs as Record<string, {
        value: number;
    }>;
    assert.deepEqual(Object.keys(outputs).sort(), ['a', 'b', 'x']);
    assert.equal(outputs.b.value, 20);
    assert.equal(outputs.x.value, 9);
    assert.equal(merged.node_statuses?.c, undefined);
});
