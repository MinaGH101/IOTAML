export function runDuration(run: { started_at: string | null; finished_at: string | null }): string {
  if (!run.started_at || !run.finished_at) return '—';
  const ms = new Date(run.finished_at).getTime() - new Date(run.started_at).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return `${Math.max(1, Math.round(ms / 1000)).toLocaleString('fa-IR')} ثانیه`;
}
