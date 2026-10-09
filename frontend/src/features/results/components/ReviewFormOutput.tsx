import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, RefreshCw } from 'lucide-react';
import type { Output } from '../../../workspace/_model/output';
import { ApiError, jsonHeaders, request } from '../../../shared/api/httpClient';

type Field = { id: string; label: string; type: string; required?: boolean; min?: number; max?: number; choices?: string[] };
type Task = { id: number; run_id?: number; project_id: number | null; case_id: string; form_id: string; status: string;
  form?: { fields: Field[]; prefill_from_case?: boolean }; response?: Record<string, unknown> | null;
  case_summary?: { fields?: Record<string, unknown> } };

function errorText(error: unknown, fields: Field[]): string {
  if (error instanceof ApiError && Array.isArray(error.details.errors)) {
    const labels = new Map(fields.map((field) => [field.id, field.label]));
    const messages: Record<string, string> = {
      required: 'این فیلد الزامی است.', range: 'مقدار خارج از بازه مجاز است.',
      type: 'نوع پاسخ صحیح نیست.', choice: 'گزینه انتخاب‌شده معتبر نیست.',
      file: 'فایل را از همین فرم بارگذاری کنید.', unknown_field: 'این فیلد در فرم وجود ندارد.',
    };
    return (error.details.errors as Array<{ field?: string; code?: string; message?: string }>).slice(0, 5)
      .map((item) => `${labels.get(item.field || '') || item.field || 'فیلد'}: ${messages[item.code || ''] || item.message || 'پاسخ نامعتبر است.'}`).join(' · ');
  }
  return error instanceof Error ? error.message : 'ثبت فرم ناموفق بود.';
}

export function ReviewFormOutput({ output }: { output: Output }) {
  const caseId = String(output.case_id || '');
  const formId = String(output.form_id || '');
  const projectId = output.project_id == null ? null : Number(output.project_id);
  const runId = output.run_id == null ? null : Number(output.run_id);
  const fields = (Array.isArray(output.form_fields) ? output.form_fields : []) as Field[];
  const [task, setTask] = useState<Task | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = async () => {
    if (!caseId || !formId) return;
    setMessage('');
    try {
      let detail: Task;
      if (runId !== null) {
        const query = new URLSearchParams({ mine: 'true', run_id: String(runId), form_id: formId,
          subject_id: caseId, limit: '1' });
        const items = await request<Task[]>(`/api/tasks?${query}`);
        if (!items[0]) { setTask(null); return; }
        detail = await request<Task>(`/api/tasks/${items[0].id}`);
      } else {
        const items = await request<Task[]>('/api/tasks?mine=true&limit=200');
        const match = items.filter((item) => item.case_id === caseId && item.form_id === formId && item.project_id === projectId)
          .sort((left, right) => right.id - left.id)[0];
        if (!match) { setTask(null); return; }
        detail = await request<Task>(`/api/tasks/${match.id}`);
      }
      if (detail.project_id !== projectId || detail.case_id !== caseId || detail.form_id !== formId) {
        setTask(null); setMessage('فرم ارجاع‌شده با این کارت مطابقت ندارد.'); return;
      }
      setTask(detail);
      const initial = detail.form?.prefill_from_case ? detail.case_summary?.fields || {} : {};
      setAnswers(detail.response || Object.fromEntries(fields.filter((field) => initial[field.id] !== undefined)
        .map((field) => [field.id, initial[field.id]])));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) { setTask(null); setMessage(''); return; }
      setMessage(error instanceof Error ? error.message : 'فرم ارجاع‌شده دریافت نشد.');
    }
  };
  useEffect(() => { void load(); }, [caseId, formId, projectId, runId]);
  const update = (id: string, value: unknown) => setAnswers((current) => ({ ...current, [id]: value }));
  const upload = async (field: Field, file?: File) => {
    if (!task || !file) return;
    setBusy(true); setMessage('');
    try {
      const data = new FormData(); data.append('file', file);
      const artifact = await request<{ id: number }>(`/api/tasks/${task.id}/fields/${field.id}/upload`,
        { method: 'POST', body: data, timeoutMs: 300_000 });
      update(field.id, String(artifact.id));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'بارگذاری فایل ناموفق بود.'); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (!task) return;
    setBusy(true); setMessage('');
    try {
      const completed = await request<Task>(`/api/tasks/${task.id}/submit`,
        { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ answers }) });
      setTask(completed); setMessage('فرم شما ثبت شد.');
    } catch (error) { setMessage(errorText(error, fields)); }
    finally { setBusy(false); }
  };
  const editable = task?.status === 'open';
  const shown = task?.status === 'completed' ? task.response || {} : answers;
  return <div className="review-output review-form-output" dir="rtl">
    <header><div><span className="review-output-eyebrow"><ClipboardList size={13} /> فرم پویا</span>
      <strong>{String(output.form_title || formId)}</strong><small dir="ltr">{caseId}</small></div>
      <span className="review-output-pill">{task?.status === 'completed' ? 'ثبت‌شده' : editable ? 'وظیفه شما' : 'پیش‌نمایش فرم'}</span></header>
    <div className="review-form-output-fields">{fields.map((field) => <label className="field" key={field.id}><span>{field.label}{field.required ? ' *' : ''}</span>
      {field.type === 'long_text' ? <textarea rows={3} disabled={!editable} value={String(shown[field.id] ?? '')} onChange={(event) => update(field.id, event.target.value)} />
        : field.type === 'choice' ? <select disabled={!editable} value={String(shown[field.id] ?? '')} onChange={(event) => update(field.id, event.target.value)}><option value="">انتخاب کنید</option>{(field.choices || []).map((choice) => <option value={choice} key={choice}>{choice}</option>)}</select>
          : field.type === 'boolean' ? <select disabled={!editable} value={shown[field.id] === true ? 'true' : shown[field.id] === false ? 'false' : ''} onChange={(event) => update(field.id, event.target.value === '' ? null : event.target.value === 'true')}><option value="">انتخاب کنید</option><option value="true">بله</option><option value="false">خیر</option></select>
            : field.type === 'file' ? <><input type="file" disabled={!editable || busy} onChange={(event) => void upload(field, event.target.files?.[0])} />{shown[field.id] && <small>فایل ثبت‌شده: {String(shown[field.id])}</small>}</>
              : <input type={field.type === 'number' || field.type === 'score' ? 'number' : field.type === 'date' ? 'date' : 'text'} min={field.min} max={field.max} disabled={!editable} value={String(shown[field.id] ?? '')} onChange={(event) => update(field.id, field.type === 'number' || field.type === 'score' ? event.target.value === '' ? null : Number(event.target.value) : event.target.value)} />}
    </label>)}</div>
    <div className="review-form-output-actions">{editable ? <button type="button" className="primary" disabled={busy} onClick={() => void submit()}>{busy ? 'در حال ثبت…' : 'ثبت فرم'}</button>
      : task?.status === 'completed' ? <span><CheckCircle2 size={15} /> پاسخ شما ثبت شده است.</span>
        : <span>برای تکمیل، این فرم باید با نود «ارجاع فرم» به شما اختصاص داده شود.</span>}
      <button type="button" className="tiny-action" onClick={() => void load()} aria-label="تازه‌سازی فرم"><RefreshCw size={14} /></button></div>
    {message && <p className="review-form-output-message" role="status">{message}</p>}
  </div>;
}
