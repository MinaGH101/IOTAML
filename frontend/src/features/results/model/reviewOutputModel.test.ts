import assert from 'node:assert/strict';
import test from 'node:test';
import { batchCaseUsesInteractiveForm, stageShowsCaseFields } from './reviewOutputModel.ts';

test('only intake and extraction outputs display accumulated case fields', () => {
  assert.equal(stageShowsCaseFields('RV-001'), true);
  assert.equal(stageShowsCaseFields('RV-003'), true);
  assert.equal(stageShowsCaseFields('RV-002'), false);
  assert.equal(stageShowsCaseFields('RV-004'), false);
  assert.equal(stageShowsCaseFields('RV-005'), false);
  assert.equal(stageShowsCaseFields('RV-009'), false);
});

test('dynamic form cases render the actual form instead of a schema summary', () => {
  assert.equal(batchCaseUsesInteractiveForm('RV-002', 'review_form'), true);
  assert.equal(batchCaseUsesInteractiveForm('RV-002', 'review_stage'), false);
  assert.equal(batchCaseUsesInteractiveForm('RV-003', 'review_form'), false);
});
