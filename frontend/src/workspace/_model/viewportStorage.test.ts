import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCanvasViewport } from './viewportStorage.ts';
test('canvas viewport normalization preserves coordinates and clamps zoom', () => {
    const fallback = { x: 0, y: 0, zoom: 1 };
    assert.deepEqual(normalizeCanvasViewport({ x: 120, y: -45, zoom: 0.7 }, fallback), { x: 120, y: -45, zoom: 0.7 });
    assert.deepEqual(normalizeCanvasViewport({ x: 'invalid', y: null, zoom: 8 }, fallback), { x: 0, y: 0, zoom: 2.25 });
});
