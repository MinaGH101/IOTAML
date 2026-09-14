import assert from 'node:assert/strict';
import test from 'node:test';
import { evenlySample } from './chartData.ts';
test('evenlySample keeps small series unchanged', () => {
    const values = [1, 2, 3];
    assert.deepEqual(evenlySample(values, 10), values);
});
test('evenlySample bounds large series and preserves endpoints', () => {
    const values = Array.from({ length: 10000 }, (_, index) => index);
    const sampled = evenlySample(values, 500);
    assert.equal(sampled.length, 500);
    assert.equal(sampled[0], 0);
    assert.equal(sampled[sampled.length - 1], 9999);
});
