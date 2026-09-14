export function WorkflowErrorCard({ problem }: { problem: Record<string, unknown> }) {
  const owner = String(problem.responsibility || 'user');
  return (
    <div className={`workflow-problem workflow-shell-card ${owner}`} dir="rtl" role="alert">
      <div className="workflow-problem-head">
        <b>{String(problem.code || problem.error_type || 'WORKFLOW_ERROR')}</b>
        <span>{owner === 'application' ? 'اشکال برنامه' : 'قابل اصلاح توسط کاربر'}</span>
      </div>
      <p>{String(problem.message || 'خطای ناشناخته')}</p>
      <dl>
        {Boolean(problem.node_name) && <><dt>نود</dt><dd>{String(problem.node_name)} <small dir="ltr">{String(problem.node_id || '')}</small></dd></>}
        {Boolean(problem.execution_id) && <><dt>اجرای workflow</dt><dd dir="ltr">{String(problem.execution_id)}</dd></>}
        {Boolean(problem.port) && <><dt>پورت ورودی</dt><dd dir="ltr">{String(problem.port)}</dd></>}
        {Boolean(problem.setting) && <><dt>تنظیم</dt><dd dir="ltr">{String(problem.setting)}</dd></>}
        {Boolean(problem.column) && <><dt>ستون</dt><dd dir="ltr">{String(problem.column)}</dd></>}
        {problem.expected !== undefined && <><dt>انتظار</dt><dd><code>{JSON.stringify(problem.expected)}</code></dd></>}
        {problem.actual !== undefined && <><dt>دریافت‌شده</dt><dd><code>{JSON.stringify(problem.actual)}</code></dd></>}
      </dl>
      {Boolean(problem.suggested_fix) && <div className="workflow-problem-fix">راه‌حل: {String(problem.suggested_fix)}</div>}
    </div>
  );
}
