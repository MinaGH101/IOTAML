import type { Run, RunSummary } from '../../../../../shared/types';
export const terminalRunStatuses = new Set(['succeeded', 'failed', 'cancelled', 'timed_out']);
export type RunReference = Pick<Run, 'id' | 'status'> | RunSummary;
