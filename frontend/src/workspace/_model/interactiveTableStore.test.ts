import assert from 'node:assert/strict';
import test from 'node:test';
import { InteractiveTableRuntime } from './interactiveTableStore.ts';
test('workspace and board subscribers receive one shared node state', () => {
    const runtime = new InteractiveTableRuntime();
    runtime.configure('workflow:1', () => undefined);
    let workspaceUpdates = 0;
    let boardUpdates = 0;
    let unrelatedUpdates = 0;
    runtime.subscribe('editor', () => { workspaceUpdates += 1; });
    runtime.subscribe('editor', () => { boardUpdates += 1; });
    runtime.subscribe('other', () => { unrelatedUpdates += 1; });
    runtime.setState('editor', {
        selection_initialized: true,
        selected_rows: ['source:0'],
        selected_columns: ['A'],
        cell_edits: { 'source:0': { A: 99 } },
    });
    assert.equal(runtime.snapshot('editor').state.cell_edits?.['source:0']?.A, 99);
    assert.equal(workspaceUpdates, 1);
    assert.equal(boardUpdates, 1);
    assert.equal(unrelatedUpdates, 0);
    runtime.dispose();
});
test('runtime coalesces rapid edits into one persistence write', async () => {
    const writes: unknown[] = [];
    const runtime = new InteractiveTableRuntime();
    runtime.configure('workflow:1', (_nodeId, state) => writes.push(state));
    runtime.setState('editor', { cell_edits: { 'source:0': { A: '9' } } });
    runtime.setState('editor', { cell_edits: { 'source:0': { A: '99' } } });
    await new Promise((resolve) => setTimeout(resolve, 220));
    assert.equal(writes.length, 1);
    assert.equal((writes[0] as {
        cell_edits: Record<string, Record<string, unknown>>;
    }).cell_edits['source:0'].A, '99');
    runtime.dispose();
});
