import { Download, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import type { Run } from '../../../shared/_types';
import type { Output } from '../../../workspace/_model/output';
import { outputsForNode } from '../../../workspace/_model/outputIndex';
import type { InteractiveTableState } from '../../../workspace/_components/output/InteractiveTableOutput';
import { OutputTable } from '../../../workspace/_components/output/OutputTable';
import { downloadText, rowsToCsv } from '../lib/outputDownload';
import { OutputCards } from './OutputCards';
import { WorkflowErrorCard } from './WorkflowErrorCard';
import { userFriendlyErrorMessage } from '../../../shared/lib/errorMessages';
import { request } from '../../../shared/api/httpClient';

export type { Output } from '../../../workspace/_model/output';
export { downloadOutput } from '../lib/outputDownload';
export { OutputRenderer as OutputBody } from './OutputRenderer';
export { OutputCard } from './OutputCard';
export { OutputCards } from './OutputCards';

export function normalizeOutputs(run: Run | null, selectedNodeId: string | null): Output[] { return outputsForNode(run, selectedNodeId); }

const statusLabel: Record<string, string> = { queued: 'در صف', running: 'در حال اجرا', succeeded: 'موفق', failed: 'ناموفق', cancelled: 'لغوشده', timed_out: 'پایان زمان مجاز' };

type Props = { run: Run | null; selectedNodeId: string | null; collapsed: boolean; onToggle: () => void; onAddToBoard?: (output: Output, index: number) => void; onInteractiveTableChange?: (nodeId: string, state: InteractiveTableState) => void };

function unchangedAssignments(run: Run | null): number {
  const taskAssignments = run?.metrics?.task_assignments;
  if (!taskAssignments || typeof taskAssignments !== 'object') return 0;
  return Number((taskAssignments as Record<string, unknown>).unchanged || 0);
}

export const ResultsPanel = memo(function ResultsPanel({ run, selectedNodeId, collapsed, onToggle, onAddToBoard, onInteractiveTableChange }: Props) {
  const comparison = (run?.artifacts?.comparison || []) as Array<Record<string, unknown>>;
  const workflowProblems = ((run?.artifacts?.errors || []) as Array<Record<string, unknown>>).filter((problem) => !selectedNodeId || String(problem.node_id || '') === selectedNodeId);
  const outputs = useMemo(() => normalizeOutputs(run, selectedNodeId), [run, selectedNodeId]);
  const [caseOutputs, setCaseOutputs] = useState<Output[]>([]);
  const projectId = Number(window.location.pathname.match(/^\/projects\/(\d+)\//)?.[1] || 0);
  useEffect(() => {
    if (!projectId || !selectedNodeId) { setCaseOutputs([]); return; }
    let active = true;
    request<Array<{ case_id: string; title: string; results: Record<string, unknown> }>>(`/api/cases?project_id=${projectId}&limit=500`)
      .then((cases) => {
        if (!active) return;
        const values: Output[] = [];
        cases.forEach((item) => {
          const stages = item.results?.stages;
          const output = stages && typeof stages === 'object' && !Array.isArray(stages)
            ? (stages as Record<string, unknown>)[selectedNodeId] : null;
          if (output && typeof output === 'object' && !Array.isArray(output)) {
            const candidate = output as Output;
            values.push({ ...candidate, case_id: candidate.case_id || item.case_id });
          }
        });
        setCaseOutputs(values);
      }).catch(() => { if (active) setCaseOutputs([]); });
    return () => { active = false; };
  }, [projectId, selectedNodeId, run?.id]);
  const shownOutputs = useMemo(() => caseOutputs.length ? [{
    node_id: selectedNodeId || '', title: outputs[0]?.title || caseOutputs[0]?.title || 'نتایج پرونده‌ها',
    kind: 'review_batch', stage: caseOutputs[0]?.stage, case_count: caseOutputs.length, cases: caseOutputs,
  } as Output] : outputs, [caseOutputs, outputs, selectedNodeId]);
  const skippedAssignments = unchangedAssignments(run);
  if (collapsed) return <section className="results-panel results-panel-collapsed workflow-shell-panel"><button className="results-mini-toggle" type="button" onClick={onToggle} title="باز کردن خروجی نود" aria-label="باز کردن خروجی نود"><PanelRightOpen size={15}/></button></section>;
  return <section className="results-panel workflow-shell-panel"><div className="panel-title results-title"><span>خروجی نود انتخاب‌شده</span><button className="tiny-action icon-action" type="button" onClick={onToggle} title="کوچک کردن خروجی نود" aria-label="کوچک کردن خروجی نود"><PanelRightClose size={13}/></button></div><div className="results-scroll">
    {!selectedNodeId && <div className="empty-state">برای دیدن خروجی فقط همان نود، روی یک نود کلیک کنید.</div>}
    {selectedNodeId && !run && <div className="empty-state">جریان را اجرا کنید تا خروجی این نود نمایش داده شود.</div>}
    {run && <><div className={`status ${run.status}`}>{statusLabel[run.status] ?? run.status}</div><div className="run-progress-summary"><span>{Math.round(Number(run.progress?.percent || 0))}%</span><progress max="100" value={Number(run.progress?.percent || 0)}/><small>{run.progress?.nodes_finished || 0}/{run.progress?.nodes_total || 0} نود · تلاش {run.attempts}/{run.max_attempts}</small></div>{skippedAssignments > 0 && <div className="empty-state" role="status">این تسک قبلا ارسال شده است.</div>}{run.error && <div className="error-box">{userFriendlyErrorMessage(run.error, run.status === 'timed_out' ? 'زمان اجرای جریان تمام شد. حجم داده یا تنظیمات نودها را سبک‌تر کنید و دوباره اجرا کنید.' : 'اجرای جریان کامل نشد. اتصال‌ها، داده ورودی و تنظیمات نودها را بررسی کنید.')}</div>}{workflowProblems.map((problem, index) => <WorkflowErrorCard problem={problem} key={`${String(problem.code || 'error')}-${index}`}/>)}{run.logs && run.logs.length > 0 && <details className="run-log-details"><summary>گزارش فنی اجرا</summary><pre>{run.logs.slice(-50).map((entry) => `${entry.timestamp} [${entry.level}] ${entry.message}`).join('\n')}</pre></details>}{!selectedNodeId && comparison.length > 0 && <div className="output-card workflow-shell-card"><div className="output-head"><b>مقایسه شاخه‌ها</b><button title="دانلود" aria-label="دانلود" onClick={() => downloadText('comparison.csv', rowsToCsv(comparison), 'text/csv;charset=utf-8')}><Download size={13}/></button></div><OutputTable rows={comparison}/></div>}{selectedNodeId && shownOutputs.length === 0 && run.status === 'succeeded' && <div className="empty-state">برای این نود خروجی قابل نمایش پیدا نشد. نود را به مسیر اجرا وصل کنید و دوباره Run بزنید.</div>}<OutputCards outputs={shownOutputs} onAddToBoard={onAddToBoard} onInteractiveTableChange={onInteractiveTableChange}/></>}
  </div></section>;
});
