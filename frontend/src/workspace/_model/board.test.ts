import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAnalysisBoardZoom, normalizeBoardViewport } from './board.ts';

test('board viewport normalizes independent persisted tab state', () => {
    assert.deepEqual(normalizeBoardViewport({ x: 12, y: 340, scale: 1.25 }), { x: 12, y: 340, scale: 1.25 });
    assert.deepEqual(normalizeBoardViewport({ x: 'invalid', y: -20, scale: 4 }), { x: 0, y: 0, scale: 1.5 });
    assert.equal(normalizeAnalysisBoardZoom(0.1), 0.5);
});
