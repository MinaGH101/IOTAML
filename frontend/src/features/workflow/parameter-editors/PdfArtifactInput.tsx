import { useEffect, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { request } from '../../../shared/api/httpClient';
import { Select } from '../../../shared/ui';
import { MultiSelect } from './Pickers';

type PdfArtifact = { id: number; original_filename: string; content_type: string };

export function PdfArtifactInput({ value, onChange, multiple = false }: { value: unknown; onChange: (id: number | number[] | null) => void; multiple?: boolean }) {
  const [files, setFiles] = useState<PdfArtifact[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const projectId = Number(window.location.pathname.match(/^\/projects\/(\d+)\//)?.[1] || 0);
  const query = projectId ? `?project_id=${projectId}` : '';
  const selectedIds = multiple ? (Array.isArray(value) ? value.map(Number).filter(Number.isSafeInteger) : value ? [Number(value)] : []) : [];
  const selectedFile = files.find((item) => item.id === Number(value));
  useEffect(() => {
    let active = true;
    request<PdfArtifact[]>(`/api/artifacts${query}&limit=200`.replace('?&', '?'))
      .then((items) => { if (active) setFiles(items.filter((item) => item.original_filename.toLowerCase().endsWith('.pdf'))); })
      .catch((exc: unknown) => { if (active) setError(exc instanceof Error ? exc.message : 'فهرست فایل‌ها بارگذاری نشد.'); });
    return () => { active = false; };
  }, [query]);
  const upload = async (selectedFiles?: FileList | null) => {
    const uploads = Array.from(selectedFiles || []);
    if (!uploads.length) return;
    if (uploads.some((file) => !file.name.toLowerCase().endsWith('.pdf'))) { setError('فقط فایل PDF پذیرفته می‌شود.'); return; }
    setBusy(true); setError('');
    try {
      const created: PdfArtifact[] = [];
      for (const file of uploads) {
        const data = new FormData(); data.append('file', file);
        const suffix = projectId ? `&project_id=${projectId}` : '';
        created.push(await request<PdfArtifact>(`/api/artifacts/upload?artifact_type=artifact${suffix}`, { method: 'POST', body: data, timeoutMs: 300_000 }));
      }
      setFiles((current) => [...created, ...current]);
      onChange(multiple ? [...new Set([...selectedIds, ...created.map((item) => item.id)])] : created[0].id);
    } catch (exc) { setError(exc instanceof Error ? exc.message : 'بارگذاری فایل ناموفق بود.'); }
    finally { setBusy(false); }
  };
  return <div className="data-file-control" dir="rtl">
    {multiple ? <><div className="artifact-picker-note"><FileText size={15} /><span>هر PDF به‌عنوان یک پرونده مستقل اجرا می‌شود.</span></div><MultiSelect options={files.map((file) => ({ value: String(file.id), label: file.original_filename, description: `PDF · #${file.id}` }))} selected={selectedIds.map(String)} onChange={(ids) => onChange(ids.map(Number))} empty="هنوز فایل PDF برای انتخاب وجود ندارد." /></>
      : <div className="field"><span>فایل‌های بارگذاری‌شده</span><Select value={String(value ?? '')} options={[{ value: '', label: 'انتخاب فایل PDF' }, ...files.map((file) => ({ value: String(file.id), label: `${file.original_filename} (#${file.id})` }))]} onChange={(selected) => onChange(selected ? Number(selected) : null)} ariaLabel="انتخاب فایل PDF" /></div>}
    <label className="data-file-upload-button"><Upload size={14} /> {busy ? 'در حال بارگذاری...' : multiple ? 'بارگذاری چند PDF' : 'بارگذاری PDF'}<input hidden type="file" multiple={multiple} accept="application/pdf,.pdf" disabled={busy} onChange={(event) => { void upload(event.target.files); event.currentTarget.value = ''; }} /></label>
    {!multiple && value ? <small><FileText size={12} /> فایل انتخاب‌شده: {selectedFile?.original_filename || `شماره ${String(value)}`}</small> : null}
    {error && <small className="data-file-error">{error}</small>}
  </div>;
}
