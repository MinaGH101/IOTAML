export function pollingDelay(status: string, failureCount: number) {
  if (failureCount > 0) return Math.min(10_000, 1_800 * (2 ** Math.min(failureCount - 1, 3)));
  if (status === 'queued') return 1_600;
  return 900;
}
