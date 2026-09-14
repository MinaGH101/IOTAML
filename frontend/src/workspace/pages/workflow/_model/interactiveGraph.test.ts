import assert from 'node:assert/strict';
import test from 'node:test';
import type { Node } from '@xyflow/react';
import { hasDocumentNodeChange, mergeCommittedPositions, } from './interactiveGraph.ts';
const node = {
    id: 'node-1',
    position: { x: 0, y: 0 },
    data: { params: { column: 'Au' } },
} as Node;
test('pointer position changes remain visual until explicitly committed', () => {
    const live = [{ ...node, position: { x: 120, y: 80 } }] as Node[];
    const committed = mergeCommittedPositions([node], live);
    assert.deepEqual(committed[0].position, { x: 120, y: 80 });
});
test('position and selection changes are classified as transient', () => {
    assert.equal(hasDocumentNodeChange([
        { type: 'position', id: node.id, position: { x: 2, y: 4 }, dragging: true },
        { type: 'select', id: node.id, selected: true },
    ]), false);
});
test('structural flow changes are classified as document changes', () => {
    assert.equal(hasDocumentNodeChange([
        { type: 'remove', id: node.id },
    ]), true);
});
