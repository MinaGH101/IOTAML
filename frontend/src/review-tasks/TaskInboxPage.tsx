import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDot, ClipboardCheck, Clock3, Download, FileText, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../app/providers/AuthProvider';
import { ApiError, downloadFile, jsonHeaders, request } from '../shared/api/httpClient';
import { AppTopNav } from '../shared/components';
import { SearchField } from '../shared/ui';

type Field = { id: string; label: string; type: string; required: boolean; min?: number; max?: number; choices?: string[] };
type Task = { id: number; project_id: number | null; project_name: string; case_id: string | null; subject_id: string; subject_type: string; task_kind: string; instructions: string; assignee_user_id: number; assignee_username: string; form_id: string; title: string;
  status: string; is_overdue: boolean; due_at: string | null; created_at: string; case_summary: { fields: Record<string, unknown>; field_labels?: Record<string, string>; documents: Array<{ artifact_id: number; filename?: string; pages?: number }>; preview_columns?: string[]; preview_rows?: Array<Record<string, unknown>>; context_items?: Array<{ label: string; value: unknown }> } | null;
  form?: { title: string; fields: Field[] }; response?: Record<string, unknown> | null };

const kindLabel = (kind: string) => ({ general: 'عمومی', analysis: 'تحلیل', approval: 'تأیید', form: 'فرم', review: 'داوری' }[kind] || 'وظیفه');
const choiceLabel = (fieldId: string, choice: string) => fieldId === 'decision'
  ? ({ approve: 'تأیید', reject: 'رد', revise: 'درخواست اصلاح' }[choice] || choice) : choice;

function formError(error: unknown, fields: Field[]): string {
  if (error instanceof ApiError && Array.isArray(error.details.errors)) {
    const labels = new Map(fields.map((field) => [field.id, field.label]));
    const messages: Record<string, string> = { required: 'این فیلد الزامی است.', range: 'مقدار خارج از بازه مجاز است.', type: 'نوع پاسخ صحیح نیست.', choice: 'گزینه انتخاب‌شده معتبر نیست.', file: 'فایل را از همین فرم بارگذاری کنید.', unknown_field: 'این فیلد در فرم وجود ندارد.' };
    return (error.details.errors as Array<{ field?: string; code?: string; message?: string }>).slice(0, 10)
      .map((item) => `${labels.get(item.field || '') || item.field || 'فیلد'}: ${messages[item.code || ''] || item.message || 'پاسخ نامعتبر است.'}`).join(' · ');
  }
  return error instanceof Error ? error.message : 'ثبت پاسخ ناموفق بود.';
}

export function TaskInboxPage() {
  const { user, logout } = useAuth();
  const projectId = Number(new URLSearchParams(window.location.search).get('project_id') || 0);
  const [mine, setMine] = useState(true); const [kindFilter, setKindFilter] = useState('all'); const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all'); const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [query, setQuery] = useState(''); const [canViewProjectResults, setCanViewProjectResults] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]); const [selected, setSelected] = useState<Task | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({}); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => {
    if (!projectId || !user) return;
    if (user.role === 'admin' || user.role === 'manager') { setCanViewProjectResults(true); return; }
    let active = true;
    void request<{ can_manage_assignments: boolean }>(`/api/projects/${projectId}`).then((project) => { if (active) setCanViewProjectResults(project.can_manage_assignments); }).catch(() => { if (active) setCanViewProjectResults(false); });
    return () => { active = false; };
  }, [projectId, user]);
  const refresh = () => {
    const params = new URLSearchParams({ mine: String(mine), limit: '200' });
    if (projectId) params.set('project_id', String(projectId)); if (kindFilter !== 'all') params.set('task_kind', kindFilter); if (statusFilter !== 'all') params.set('status', statusFilter);
    setMessage(''); return request<Task[]>(`/api/tasks?${params}`).then(setTasks).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'خطا در دریافت کارتابل'));
  };
  useEffect(() => { void refresh(); }, [mine, kindFilter, statusFilter, projectId]);
  const projectOptions = useMemo(() => [...new Map(tasks.filter((task) => task.project_id !== null).map((task) => [task.project_id as number, task.project_name || `پروژه ${task.project_id}`])).entries()], [tasks]);
  const visibleTasks = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fa');
    return tasks.filter((task) => projectFilter === 'all' || String(task.project_id) === projectFilter)
      .filter((task) => !term || `${task.title} ${task.project_name} ${task.subject_id} ${task.assignee_username}`.toLocaleLowerCase('fa').includes(term))
      .sort((left, right) => (new Date(left.created_at).getTime() - new Date(right.created_at).getTime()) * (sortOrder === 'newest' ? -1 : 1));
  }, [projectFilter, query, sortOrder, tasks]);
  const openCount = tasks.filter((task) => task.status === 'open').length; const completedCount = tasks.length - openCount;
  const overdueCount = tasks.filter((task) => task.is_overdue).length;
  const open = async (task: Task) => { setMessage(''); try { const detail = await request<Task>(`/api/tasks/${task.id}`); setSelected(detail); setAnswers(detail.response || {}); } catch (error) { setMessage(error instanceof Error ? error.message : 'خطا در دریافت وظیفه'); } };
  const update = (id: string, value: unknown) => setAnswers((current) => ({ ...current, [id]: value }));
  const upload = async (field: Field, file?: File) => { if (!file || !selected) return; setBusy(true); setMessage(''); try { const data = new FormData(); data.append('file', file); const artifact = await request<{ id: number }>(`/api/tasks/${selected.id}/fields/${field.id}/upload`, { method: 'POST', body: data, timeoutMs: 300_000 }); update(field.id, String(artifact.id)); } catch (error) { setMessage(error instanceof Error ? error.message : 'بارگذاری فایل ناموفق بود'); } finally { setBusy(false); } };
  const submit = async () => { if (!selected) return; setBusy(true); setMessage(''); try { const completed = await request<Task>(`/api/tasks/${selected.id}/submit`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ answers }) }); setSelected(completed); setMessage('پاسخ وظیفه با موفقیت ثبت شد.'); await refresh(); } catch (error) { setMessage(formError(error, selected.form?.fields || [])); } finally { setBusy(false); } };
  if (!user) return null;
  const editable = selected?.status === 'open' && selected.assignee_user_id === user.id;
  return <div className="app-shell review-inbox" dir="rtl">
    <AppTopNav user={user} title="کارتابل وظایف" onBack={() => { if (window.history.length > 1) window.history.back(); else window.location.href = '/projects'; }} onProjects={() => { window.location.href = '/projects'; }} onProfile={() => { window.location.href = '/profile'; }} onAdmin={() => { window.location.href = '/admin'; }} onLogout={logout} />
    <main className="task-page">
      <header className="task-page-heading"><div><h2>کارهای در انتظار شما</h2></div><button type="button" className="task-refresh" disabled={busy} onClick={() => void refresh()}><RefreshCw size={16} /> تازه‌سازی</button></header>
      <section className="task-summary"><article><CircleDot size={18} /><span>باز</span><b>{openCount.toLocaleString('fa-IR')}</b></article><article className="overdue"><Clock3 size={18} /><span>سررسید گذشته</span><b>{overdueCount.toLocaleString('fa-IR')}</b></article><article><ClipboardCheck size={18} /><span>تکمیل‌شده</span><b>{completedCount.toLocaleString('fa-IR')}</b></article><article><Clock3 size={18} /><span>همه وظایف</span><b>{tasks.length.toLocaleString('fa-IR')}</b></article></section>
      <section className="task-workspace">
        <aside className="task-list-panel">
          <div className="task-scope-row"><div><h3>{mine ? 'وظایف من' : 'نتایج پروژه'}</h3><small>{visibleTasks.length.toLocaleString('fa-IR')} مورد</small></div>{projectId > 0 && canViewProjectResults && <div className="task-scope-switch"><button type="button" className={mine ? 'active' : ''} onClick={() => { setMine(true); setSelected(null); }}>من</button><button type="button" className={!mine ? 'active' : ''} onClick={() => { setMine(false); setSelected(null); }}>پروژه</button></div>}</div>
          <SearchField containerClassName="task-search" leading={<Search size={15} />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی عنوان، پرونده یا مسئول..." aria-label="جستجوی وظایف" />
          <div className="task-filters"><select aria-label="نوع وظیفه" value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option value="all">همه نوع‌ها</option><option value="general">عمومی</option><option value="analysis">تحلیل</option><option value="approval">تأیید</option><option value="form">فرم</option><option value="review">داوری</option></select><select aria-label="وضعیت وظیفه" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">همه وضعیت‌ها</option><option value="open">باز</option><option value="overdue">سررسید گذشته</option><option value="completed">تکمیل‌شده</option></select><select aria-label="پروژه" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">همه پروژه‌ها</option>{projectOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><select aria-label="ترتیب وظایف" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'newest' | 'oldest')}><option value="newest">جدیدترین</option><option value="oldest">قدیمی‌ترین</option></select></div>
          <div className="task-list">{visibleTasks.map((task) => <button type="button" key={task.id} className={`${selected?.id === task.id ? 'selected' : ''} ${task.is_overdue ? 'overdue' : ''}`} onClick={() => void open(task)}><span className={`task-kind kind-${task.task_kind}`}>{kindLabel(task.task_kind)}</span><span className="task-project">{task.project_name || 'بدون پروژه'}</span><strong>{task.title}</strong><span className="task-subject">{task.subject_id}{!mine && task.assignee_username ? ` · ${task.assignee_username}` : ''}</span><footer><span className={task.status === 'completed' ? 'done' : task.is_overdue ? 'overdue-label' : 'open'}>{task.status === 'completed' ? 'تکمیل‌شده' : task.is_overdue ? 'سررسید گذشته' : 'در انتظار پاسخ'}</span>{task.due_at && <time>{new Date(task.due_at).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' })}</time>}</footer></button>)}{visibleTasks.length === 0 && <div className="task-empty"><ClipboardCheck size={28} /><b>وظیفه‌ای پیدا نشد</b><span>فیلترها یا عبارت جستجو را تغییر دهید.</span></div>}</div>
        </aside>
        <section className="task-detail-panel">
          {!selected && <div className="task-detail-empty"><ClipboardCheck size={42} /><h3>یک وظیفه را انتخاب کنید</h3><p>جزئیات، اسناد مرتبط و فرم پاسخ در این بخش نمایش داده می‌شود.</p></div>}
          {selected && <><header className="task-detail-head"><div><span className={`task-kind kind-${selected.task_kind}`}>{kindLabel(selected.task_kind)}</span><h2>{selected.title}</h2><p>{selected.subject_type === 'case' ? 'پرونده' : 'اجرا'} <b dir="ltr">{selected.subject_id}</b>{!mine && selected.assignee_username ? ` · مسئول: ${selected.assignee_username}` : ''}</p></div><span className={`task-status ${selected.status}`}>{selected.status === 'completed' ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}{selected.status === 'completed' ? 'ثبت‌شده' : 'باز'}</span></header>
            {selected.instructions && <section className="task-instructions"><b>راهنمای انجام کار</b><p>{selected.instructions}</p></section>}
            {selected.case_summary && (Object.keys(selected.case_summary.fields || {}).length > 0 || (selected.case_summary.documents || []).length > 0) && <section className="task-context"><h3>اطلاعات و مستندات مرتبط</h3><div className="task-context-grid">{Object.entries(selected.case_summary.fields || {}).map(([key, value]) => <div key={key}><span>{selected.case_summary?.field_labels?.[key] || key}</span><b>{String(value ?? '—')}</b></div>)}</div>
              {(selected.case_summary?.documents || []).length > 0 && <div className="task-documents">{selected.case_summary?.documents.map((document) => <button type="button" key={document.artifact_id} title="دانلود PDF" onClick={() => void downloadFile(`/api/artifacts/${document.artifact_id}/download`, document.filename || `document-${document.artifact_id}`).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'دریافت سند ناموفق بود'))}><FileText size={17} /><span><b>{document.filename || `سند شماره ${document.artifact_id}`}</b><small>{document.pages ? `${document.pages} صفحه` : 'فایل پیوست'}</small></span><Download className="task-document-download" size={16} aria-hidden="true" /></button>)}</div>}
              {Boolean(selected.case_summary?.preview_rows?.length) && <div className="task-table-wrap"><table><thead><tr>{(selected.case_summary?.preview_columns || []).map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{selected.case_summary?.preview_rows?.map((row, index) => <tr key={index}>{(selected.case_summary?.preview_columns || []).map((column) => <td key={column}>{String(row[column] ?? '')}</td>)}</tr>)}</tbody></table></div>}
              {(selected.case_summary?.context_items || []).map((item, index) => <details className="task-context-item" key={`${item.label}-${index}`}><summary>{item.label}</summary><pre dir="ltr">{JSON.stringify(item.value, null, 2)}</pre></details>)}
            </section>}
            <section className="task-response"><div className="task-section-heading"><h3>{selected.status === 'completed' ? 'پاسخ ثبت‌شده' : 'پاسخ شما'}</h3><span>فیلدهای ستاره‌دار الزامی هستند.</span></div><div className="task-form-grid">{(selected.form?.fields || []).map((field) => <label className={field.type === 'long_text' || field.type === 'file' ? 'wide' : ''} key={field.id}><span>{field.label}{field.required ? <em>*</em> : ''}</span>
              {field.type === 'long_text' ? <textarea rows={5} disabled={!editable} value={String(answers[field.id] ?? '')} onChange={(event) => update(field.id, event.target.value)} /> : field.type === 'choice' ? <select disabled={!editable} value={String(answers[field.id] ?? '')} onChange={(event) => update(field.id, event.target.value)}><option value="">انتخاب کنید</option>{(field.choices || []).map((choice) => <option key={choice} value={choice}>{choiceLabel(field.id, choice)}</option>)}</select> : field.type === 'boolean' ? <select disabled={!editable} value={answers[field.id] === true ? 'true' : answers[field.id] === false ? 'false' : ''} onChange={(event) => update(field.id, event.target.value === '' ? null : event.target.value === 'true')}><option value="">انتخاب کنید</option><option value="true">بله</option><option value="false">خیر</option></select> : field.type === 'file' ? <div className="task-file-field">{editable && <input type="file" disabled={busy} onChange={(event) => void upload(field, event.target.files?.[0])} />}{answers[field.id] ? <button type="button" onClick={() => void downloadFile(`/api/artifacts/${String(answers[field.id])}/download`, `task-${selected.id}-${field.id}`)}><FileText size={15} /> دریافت فایل پیوست</button> : <small>فایلی ثبت نشده است.</small>}</div> : <input type={field.type === 'number' || field.type === 'score' ? 'number' : field.type === 'date' ? 'date' : 'text'} min={field.min} max={field.max} disabled={!editable} value={String(answers[field.id] ?? '')} onChange={(event) => update(field.id, field.type === 'number' || field.type === 'score' ? (event.target.value === '' ? null : Number(event.target.value)) : event.target.value)} />}
              {(field.type === 'number' || field.type === 'score') && <small>بازه مجاز: {field.min ?? 0} تا {field.max ?? 'بدون سقف'}</small>}</label>)}</div>
              <div className="task-submit-row">{selected.status === 'completed' ? <span className="task-completed-note"><CheckCircle2 size={17} /> پاسخ این وظیفه ثبت شده است.</span> : editable ? <button type="button" className="task-submit" disabled={busy} onClick={() => void submit()}>{busy ? 'در حال ثبت…' : 'ثبت پاسخ'}</button> : <span>این وظیفه فقط توسط مسئول آن قابل ثبت است.</span>}</div>
            </section></>}
          {message && <p role="status" className="task-message">{message}</p>}
        </section>
      </section>
    </main>
  </div>;
}
