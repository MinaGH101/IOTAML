import assert from 'node:assert/strict';
import test from 'node:test';
import { pollingDelay } from './pollingPolicy.ts';

test('queued runs poll slower than running runs', () => {
  assert.equal(pollingDelay('queued', 0), 1600);
  assert.equal(pollingDelay('running', 0), 900);
});

test('polling failures back off with a fixed upper bound', () => {
  assert.equal(pollingDelay('running', 1), 1800);
  assert.equal(pollingDelay('running', 2), 3600);
  assert.equal(pollingDelay('running', 20), 10000);
});
