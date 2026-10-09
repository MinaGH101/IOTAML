import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewBatchStage } from './reviewBatchOutput.ts';

test('pinned extraction batches retain the stage required to render case fields', () => {
  const cases = [{ case_id: 'proposal-1', stage: 'RV-003', fields: { summary: 'Extracted' } }];
  assert.equal(reviewBatchStage(cases), 'RV-003');
});

test('current output supplies the stage when persisted cases do not have one', () => {
  assert.equal(reviewBatchStage([{ case_id: 'proposal-1' }], { stage: 'RV-004' }), 'RV-004');
});
