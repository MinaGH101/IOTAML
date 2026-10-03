import { workflowProblemCopy } from '../../../shared/lib/errorMessages';

export function WorkflowErrorCard({ problem }: { problem: Record<string, unknown> }) {
  const owner = String(problem.responsibility || 'user');
  const copy = workflowProblemCopy(problem);
  const showContractDetails = owner !== 'application';
  return (
    <div className={`workflow-problem workflow-shell-card ${owner}`} dir="rtl" role="alert">
      <div className="workflow-problem-head">
        <b>جزئیات مشکل</b>
        <span>{owner === 'application' ? 'مشکل موقت برنامه' : 'قابل اصلاح توسط کاربر'}</span>
      </div>
      <p>{copy.message}</p>
      <dl>
        {Boolean(problem.node_name) && <><dt>نود</dt><dd>{String(problem.node_name)}</dd></>}
        {Boolean(problem.execution_id) && <><dt>اجرای workflow</dt><dd dir="ltr">{String(problem.execution_id)}</dd></>}
        {Boolean(problem.port) && <><dt>پورت ورودی</dt><dd dir="ltr">{String(problem.port)}</dd></>}
        {Boolean(problem.setting) && <><dt>تنظیم</dt><dd dir="ltr">{String(problem.setting)}</dd></>}
        {Boolean(problem.column) && <><dt>ستون</dt><dd dir="ltr">{String(problem.column)}</dd></>}
        {showContractDetails && problem.expected !== undefined && <><dt>انتظار</dt><dd><code>{JSON.stringify(problem.expected)}</code></dd></>}
        {showContractDetails && problem.actual !== undefined && <><dt>دریافت‌شده</dt><dd><code>{JSON.stringify(problem.actual)}</code></dd></>}
      </dl>
      <div className="workflow-problem-fix">راه‌حل: {copy.action}</div>
    </div>
  );
}
