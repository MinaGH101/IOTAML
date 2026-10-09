const CASE_FIELD_STAGES = new Set(['RV-001', 'RV-003']);

export function stageShowsCaseFields(stage: string) {
  return CASE_FIELD_STAGES.has(stage);
}

export function batchCaseUsesInteractiveForm(stage: string, kind: string) {
  return stage === 'RV-002' && kind === 'review_form';
}
