import { RefreshCw, RotateCcw, Square } from 'lucide-react';
import type { RunSummary } from '../../../../shared/_types';
import { formatDateTime, runDuration } from '../../../../shared/_utils/appShared';

export function RunHistoryPanel({
  runs,
  currentRunId,
  busy,
  onSelect,
  onRetry,
  onCancel,
  onRefresh,
}: {
  runs: RunSummary[];
  currentRunId?: number | null;
  busy: boolean;
  onSelect: (run: RunSummary) => void;
  onRetry: (run: RunSummary) => void;
  onCancel: (run: RunSummary) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="run-history-panel workflow-tab-history-panel">
      <div className="workflow-tab-content-head">
        <span>تاریخچه اجرا و Debug</span>
        <button type="button" className="workflow-tab-icon-button" onClick={onRefresh} title="به‌روزرسانی" aria-label="به‌روزرسانی"><RefreshCw size={17}/></button>
      </div>
      <div className="run-history-list">
        {runs.slice(0, 20).map((run) => (
          <div key={run.id} className={`run-history-row ${currentRunId === run.id ? 'active' : ''}`}>
            <button type="button" className="run-history-main" onClick={() => onSelect(run)}>
              <span className={`run-dot ${run.status}`} />
              <b>{run.workflow_name}</b>
              <small>#{run.id} · {formatDateTime(run.created_at)} · {runDuration(run)} · تلاش {run.attempts}/{run.max_attempts}</small>
              <small>{Math.round(Number(run.progress?.percent || 0))}% · {run.status}</small>
            </button>
            {['queued', 'running'].includes(run.status)
              ? <button type="button" className="workflow-tab-icon-button" onClick={() => onCancel(run)} title="توقف اجرا" aria-label="توقف اجرا"><Square size={13} /></button>
              : <button type="button" className="workflow-tab-icon-button" disabled={busy} onClick={() => onRetry(run)} title="اجرای دوباره با همین گراف" aria-label="اجرای دوباره"><RotateCcw size={17}/></button>}
          </div>
        ))}
        {runs.length === 0 && <div className="empty-state small">هنوز اجرای ذخیره‌شده‌ای برای این پروژه وجود ندارد.</div>}
      </div>
    </section>
  );
}
