import type { Output } from '../../../_model/output';

export function reviewBatchStage(cases: Array<Record<string, unknown>>, currentOutput?: Output) {
  const savedStage = cases.find((item) => typeof item.stage === 'string' && item.stage)?.stage;
  return String(savedStage || currentOutput?.stage || '');
}
