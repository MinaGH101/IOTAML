import assert from 'node:assert/strict';
import test from 'node:test';
import { createOutputSnapshot } from './outputSnapshot.ts';
test('table snapshots retain metadata but bound persisted rows', () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({ index, value: index * 2 }));
    const snapshot = createOutputSnapshot({
        kind: 'table',
        title: 'Large table',
        node_id: 'node-1',
        rows,
        columns: ['index', 'value'],
    });
    assert.equal((snapshot?.rows as unknown[]).length, 250);
    assert.equal(snapshot?.snapshot_truncated, true);
    assert.equal(snapshot?.title, 'Large table');
});
test('plot-group snapshots bound plots and point arrays recursively', () => {
    const plots = Array.from({ length: 80 }, (_, plotIndex) => ({
        kind: 'scatter',
        title: `Plot ${plotIndex}`,
        points: Array.from({ length: 2000 }, (_, index) => ({ x: index, y: index })),
    }));
    const snapshot = createOutputSnapshot({ kind: 'plot_group', plots });
    assert.equal((snapshot?.plots as unknown[]).length, 60);
    const first = (snapshot?.plots as Array<Record<string, unknown>>)[0];
    assert.equal((first.points as unknown[]).length, 1200);
    assert.equal(snapshot?.snapshot_truncated, true);
});
