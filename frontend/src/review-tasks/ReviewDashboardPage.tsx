import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bot, CheckCircle2, FilePlus2, Play, RefreshCw, UsersRound } from 'lucide-react';
import { jsonHeaders, request } from '../shared/api/httpClient';

type ProjectOption = { id: number; name: string };
type WorkflowOption = { id: number; name: string; graph: { nodes?: Array<{ type?: string; data?: { registryId?: string } }> } };
type CaseRecord = { id: number; project_id: number; case_id: string; title: string; fields: Record<string, unknown>;
  primary_artifact_id: number; status: string; workflow_id: number | null; latest_run_id: number | null;
  score: number | null; score_max: number | null; results: Record<string, unknown> };
type CaseDetail = CaseRecord & { reviews: Array<{ task_id: number; assignee_user_id: number; assignee: string; status: string; answers: Record<string, unknown> | null }>;
  runs: Array<{ id: number; stage: string; status: string; error: string | null }> };
type ImportDraft = { file: File; case_id: string; title: string; proposer: string; project_manager: string; requested_budget: string };

const labels: Record<string, string> = { project_title: 'عنوان طرح', project_code: 'کد پرونده', proposer: 'پیشنهاددهنده',
  project_manager: 'مدیر پروژه', requested_budget: 'بودجه درخواستی', project_goal: 'هدف پروژه' };
const statuses: Record<string, string> = { new: 'جدید', queued: 'در صف', running: 'در حال اجرا', processed: 'پردازش‌شده',
  awaiting_review: 'در انتظار امتیازها', scoring: 'در حال تجمیع', completed: 'تکمیل‌شده', failed: 'ناموفق' };
const record = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const display = (value: unknown) => value === null || value === undefined || value === '' ? '—'
  : typeof value === 'number' ? value.toLocaleString('fa-IR') : typeof value === 'object' ? JSON.stringify(value) : String(value);
const suggestedId = (filename: string, index: number) => filename.replace(/\.pdf$/i, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || `CASE-${index + 1}`;

export function ReviewDashboardPage() {
  const generation = useRef(0);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [projectId, setProjectId] = useState<number | null>(() => Number(new URLSearchParams(location.search).get('project_id')) || null);
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [assignees, setAssignees] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [minScore, setMinScore] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadCases = async () => {
    if (!projectId) { setCases([]); return; }
    const current = ++generation.current;
    const query = new URLSearchParams({ project_id: String(projectId) });
    if (search.trim()) query.set('search', search.trim());
    if (status) query.set('status', status);
    if (minScore) query.set('min_score', minScore);
    try { const result = await request<CaseRecord[]>(`/api/cases?${query}`); if (current === generation.current) setCases(result); }
    catch (error) { if (current === generation.current) setMessage(error instanceof Error ? error.message : 'دریافت پرونده‌ها ناموفق بود.'); }
  };
  useEffect(() => { void request<ProjectOption[]>('/api/projects?limit=200').then((items) => {
    setProjects(items); if (!projectId && items[0]) setProjectId(items[0].id);
  }).catch(() => setMessage('دریافت پروژه‌ها ناموفق بود.')); }, []);
  useEffect(() => { if (!projectId) return; setSelected(new Set()); setActiveId(null); setDetail(null);
    void request<WorkflowOption[]>(`/api/workflows?project_id=${projectId}&limit=200`).then((items) => {
      const compatible = items.filter((item) => { const ids = new Set((item.graph?.nodes || []).map((node) => node.data?.registryId || node.type)); return ids.has('RV-001') && ids.has('RV-009'); });
      setWorkflows(compatible); setWorkflowId(compatible[0]?.id ?? null);
    });
  }, [projectId]);
  useEffect(() => { const timer = window.setTimeout(() => { void loadCases(); }, 180); return () => window.clearTimeout(timer); }, [projectId, search, status, minScore]);
  useEffect(() => { if (!activeId) { setDetail(null); return; } void request<CaseDetail>(`/api/cases/${activeId}`).then(setDetail).catch((error) => setMessage(error instanceof Error ? error.message : 'دریافت نتیجه ناموفق بود.')); }, [activeId]);

  const chooseFiles = (files: FileList | null) => setDrafts(Array.from(files || []).map((file, index) => ({
    file, case_id: suggestedId(file.name, index), title: file.name.replace(/\.pdf$/i, ''), proposer: '', project_manager: '', requested_budget: '',
  })));
  const importCases = async () => {
    if (!projectId || !drafts.length) return;
    setBusy(true); setMessage('');
    try {
      const body = new FormData(); body.append('project_id', String(projectId));
      body.append('metadata', JSON.stringify(drafts.map(({ case_id, title, proposer, project_manager, requested_budget }) => ({
        case_id, title, fields: { ...(proposer ? { proposer } : {}), ...(project_manager ? { project_manager } : {}),
          ...(requested_budget ? { requested_budget: Number(requested_budget) } : {}) },
      }))));
      drafts.forEach(({ file }) => body.append('files', file));
      const result = await request<{ count: number }>('/api/cases/import', { method: 'POST', body, timeoutMs: 300_000 });
      setDrafts([]); setMessage(`${result.count.toLocaleString('fa-IR')} پرونده با موفقیت وارد شد.`); await loadCases();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'ورود پرونده‌ها ناموفق بود.'); } finally { setBusy(false); }
  };
  const run = async (newOnly: boolean) => {
    if (!projectId || !workflowId || (!newOnly && selected.size === 0)) return;
    setBusy(true); setMessage('');
    try {
      const result = await request<{ count: number }>('/api/cases/run', { method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ project_id: projectId, workflow_id: workflowId, case_record_ids: newOnly ? [] : [...selected],
          assignees: assignees.split(',').map((item) => item.trim()).filter(Boolean), new_only: newOnly }) });
      setSelected(new Set()); setMessage(`${result.count.toLocaleString('fa-IR')} اجرای مستقل در صف قرار گرفت.`); await loadCases();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'اجرای پرونده‌ها ناموفق بود.'); } finally { setBusy(false); }
  };
  const toggle = (id: number) => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const scored = cases.filter((item) => item.score !== null);
  const completed = cases.filter((item) => item.status === 'completed').length;
  const awaiting = cases.filter((item) => item.status === 'awaiting_review').length;
  const details = record(detail?.results);
  const fields = record(details.fields || detail?.fields);
  const ai = record(details.ai_review);
  const scores = record(details.scores);
  const criteria = record(scores.criteria);

  return <div className="app-shell review-dashboard case-center" dir="rtl">
    <header className="review-inbox-header"><a href="/projects"><ArrowRight size={16} /> پروژه‌ها</a><h1>پرونده‌ها و نتایج</h1>
      <select aria-label="پروژه" value={projectId || ''} onChange={(event) => setProjectId(Number(event.target.value) || null)}><option value="">انتخاب پروژه</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <a href="/tasks">کارتابل کاربران</a><button type="button" onClick={() => void loadCases()}><RefreshCw size={15} /> تازه‌سازی</button></header>
    <main className="review-dashboard-content">
      {message && <p className="review-inbox-message" role="status">{message}</p>}
      <section className="case-import-panel">
        <div><h2>ورود گروهی پرونده‌ها</h2><p>هر PDF به یک پرونده مستقل تبدیل می‌شود. کد و عنوان را پیش از ثبت بررسی کنید.</p></div>
        <label className="case-file-picker"><FilePlus2 size={18} /><span>انتخاب چند PDF</span><input type="file" accept="application/pdf,.pdf" multiple disabled={!projectId || busy} onChange={(event) => chooseFiles(event.target.files)} /></label>
        {drafts.length > 0 && <div className="case-import-drafts">{drafts.map((draft, index) => <div key={`${draft.file.name}-${index}`}><small>{draft.file.name}</small><input aria-label="کد پرونده" placeholder="کد پرونده" value={draft.case_id} onChange={(event) => setDrafts((rows) => rows.map((row, i) => i === index ? { ...row, case_id: event.target.value } : row))} /><input aria-label="عنوان پرونده" placeholder="عنوان" value={draft.title} onChange={(event) => setDrafts((rows) => rows.map((row, i) => i === index ? { ...row, title: event.target.value } : row))} /><input aria-label="پیشنهاددهنده" placeholder="پیشنهاددهنده" value={draft.proposer} onChange={(event) => setDrafts((rows) => rows.map((row, i) => i === index ? { ...row, proposer: event.target.value } : row))} /><input aria-label="مدیر پروژه" placeholder="مدیر پروژه" value={draft.project_manager} onChange={(event) => setDrafts((rows) => rows.map((row, i) => i === index ? { ...row, project_manager: event.target.value } : row))} /><input type="number" min="0" aria-label="بودجه درخواستی" placeholder="بودجه" value={draft.requested_budget} onChange={(event) => setDrafts((rows) => rows.map((row, i) => i === index ? { ...row, requested_budget: event.target.value } : row))} /></div>)}</div>}
        <button className="case-primary-action" type="button" disabled={!drafts.length || busy} onClick={() => void importCases()}>ثبت {drafts.length ? drafts.length.toLocaleString('fa-IR') : ''} پرونده</button>
      </section>

      <div className="review-dashboard-kpis"><article><FilePlus2 size={22} /><span>پرونده‌ها</span><strong>{cases.length.toLocaleString('fa-IR')}</strong></article><article><UsersRound size={22} /><span>در انتظار کاربران</span><strong>{awaiting.toLocaleString('fa-IR')}</strong></article><article><CheckCircle2 size={22} /><span>نتیجه کامل</span><strong>{completed.toLocaleString('fa-IR')}</strong></article><article><Bot size={22} /><span>دارای امتیاز</span><strong>{scored.length.toLocaleString('fa-IR')}</strong></article></div>

      <section className="case-run-panel"><div><select aria-label="جریان کاری" value={workflowId || ''} onChange={(event) => setWorkflowId(Number(event.target.value) || null)}><option value="">انتخاب جریان کاری</option>{workflows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input aria-label="کاربران امتیازدهنده" placeholder="نام کاربری داوران، جداشده با ویرگول" value={assignees} onChange={(event) => setAssignees(event.target.value)} /></div><button type="button" disabled={busy || !workflowId} onClick={() => void run(true)}><Play size={15} /> اجرای پرونده‌های جدید</button><button type="button" disabled={busy || !workflowId || selected.size === 0} onClick={() => void run(false)}><Play size={15} /> اجرای انتخاب‌شده‌ها ({selected.size.toLocaleString('fa-IR')})</button></section>

      <section className="review-dashboard-table"><div className="review-dashboard-table-head"><div><h2>برد نتایج پرونده‌ها</h2><p>یک پرونده را برای مشاهده خروجی کامل انتخاب کنید.</p></div><input aria-label="جستجوی پرونده" placeholder="کد یا عنوان..." value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="وضعیت" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">همه وضعیت‌ها</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input type="number" min="0" aria-label="حداقل امتیاز" placeholder="امتیاز ≥" value={minScore} onChange={(event) => setMinScore(event.target.value)} /></div>
        <div className="case-board-layout"><div className="review-dashboard-table-scroll"><table><thead><tr><th></th><th>پرونده</th><th>امتیاز</th><th>وضعیت</th></tr></thead><tbody>{cases.map((item) => <tr key={item.id} className={activeId === item.id ? 'case-active-row' : ''} onClick={() => setActiveId(item.id)}><td><input type="checkbox" aria-label={`انتخاب ${item.case_id}`} checked={selected.has(item.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggle(item.id)} /></td><td><strong>{item.title}</strong><small dir="ltr">{item.case_id}</small></td><td>{item.score === null ? '—' : `${display(item.score)} / ${display(item.score_max)}`}</td><td><span className={item.status === 'completed' ? 'complete' : 'pending'}>{statuses[item.status] || item.status}</span></td></tr>)}{cases.length === 0 && <tr><td colSpan={4}>پرونده‌ای با این فیلتر یافت نشد.</td></tr>}</tbody></table></div>
          <aside className="case-result-board">{!detail ? <div className="case-empty-result">یک پرونده را از جدول انتخاب کنید.</div> : <><header><div><small dir="ltr">{detail.case_id}</small><h2>{detail.title}</h2></div>{detail.score !== null && <strong>{display(detail.score)} <small>از {display(detail.score_max)}</small></strong>}</header>
            <section><h3>اطلاعات استخراج‌شده</h3><div className="case-result-grid">{Object.entries(fields).filter(([key]) => key !== 'project_code' && key !== 'project_title').map(([key, value]) => <div key={key}><span>{labels[key] || key}</span><b>{display(value)}</b></div>)}</div></section>
            <section><h3>نظر کمکی هوش مصنوعی</h3><p>{String(ai.summary || 'هنوز نتیجه‌ای ثبت نشده است.')}</p>{Object.keys(record(ai.scores)).length > 0 && <div className="case-score-chips">{Object.entries(record(ai.scores)).map(([key, value]) => <span key={key}>{key}: <b>{display(value)}</b></span>)}</div>}</section>
            <section><h3>امتیاز کاربران</h3>{detail.reviews.length === 0 ? <p>هنوز پاسخی ثبت نشده است.</p> : detail.reviews.map((review) => <div className="case-review-answer" key={review.task_id}><span>{review.assignee}</span><b>{review.status === 'completed' ? Object.values(review.answers || {}).filter((value) => typeof value === 'number').reduce<number>((sum, value) => sum + Number(value), 0).toLocaleString('fa-IR') : 'در انتظار'}</b></div>)}</section>
            {Object.keys(criteria).length > 0 && <section><h3>جمع‌بندی امتیاز پرونده</h3><div className="case-score-chips">{Object.entries(criteria).map(([key, value]) => <span key={key}>{String(record(scores.labels)[key] || key)}: <b>{display(value)}</b></span>)}</div></section>}
          </>}</aside></div>
      </section>
    </main>
  </div>;
}
