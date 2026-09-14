import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBoardItems } from './boardOutputs.ts';
import type { AnalysisBoardItem } from './board.ts';
const referencedItem: AnalysisBoardItem = {
    id: 'pin-1',
    nodeId: 'node-1',
    outputRef: { runId: 1, nodeId: 'node-1', outputId: 'out-1' },
    outputIndex: 0,
    outputTitle: 'Distribution',
    outputKind: 'plot',
    x: 0,
    y: 0,
    w: 300,
    h: 220,
    runId: 1,
    createdAt: '2026-01-01T00:00:00Z',
};
test('board resolves the canonical output by reference while workflow is dirty', () => {
    const [resolved] = resolveBoardItems([referencedItem], [{ id: 'out-1', kind: 'plot', title: 'Distribution', node_id: 'node-1', value: 'current' }], true);
    assert.equal(resolved.output?.value, 'current');
    assert.equal(resolved.stale, true);
});
test('legacy board snapshots remain readable during migration', () => {
    const legacyItem: AnalysisBoardItem = {
        ...referencedItem,
        outputRef: undefined,
        snapshot: { kind: 'plot', title: 'Distribution', node_id: 'node-1', value: 'legacy' },
    };
    const [resolved] = resolveBoardItems([legacyItem], [], false);
    assert.equal(resolved.output?.value, 'legacy');
    assert.equal(resolved.stale, true);
});
