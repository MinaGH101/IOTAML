import assert from 'node:assert/strict';
import test from 'node:test';
import { boardItemsContainOutput, boardOutputKey, resolveBoardItems } from './boardOutputs.ts';
import type { AnalysisBoardItem } from './board.ts';
const referencedOutput = { id: 'out-1', kind: 'plot', title: 'Distribution', node_id: 'node-1' };
const referencedItem: AnalysisBoardItem = {
    id: 'pin-1',
    nodeId: 'node-1',
    outputRef: { runId: 1, nodeId: 'node-1', outputId: 'out-1' },
    outputKey: boardOutputKey(referencedOutput),
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
    const [resolved] = resolveBoardItems([referencedItem], [{ ...referencedOutput, value: 'current' }], true);
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
test('board resolves refreshed workspace output by source key when output id changes', () => {
    const [resolved] = resolveBoardItems([referencedItem], [{
            output_id: 'out-2',
            kind: 'plot',
            title: 'Distribution',
            node_id: 'node-1',
            value: 'updated',
        }], false);
    assert.equal(resolved.output?.value, 'updated');
    assert.equal(resolved.stale, false);
});
test('board detects duplicate source outputs before adding another card', () => {
    const output = {
        output_id: 'out-1',
        kind: 'plot',
        title: 'Distribution',
        node_id: 'node-1',
        value: 'current',
    };
    assert.equal(boardItemsContainOutput([referencedItem], output, null, 0), true);
    assert.equal(boardItemsContainOutput([referencedItem], { ...output, node_id: 'node-2' }, null, 0), false);
});
