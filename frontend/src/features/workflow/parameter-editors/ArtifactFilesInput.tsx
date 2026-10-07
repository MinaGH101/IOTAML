import { useEffect, useState } from 'react';
import { Paperclip, Upload } from 'lucide-react';
import { request } from '../../../shared/api/httpClient';
import { MultiSelect } from './Pickers';

type ArtifactFile = { id: number; original_filename: string };

export function ArtifactFilesInput({ value, onChange, excludedIds = [] }: { value: unknown; onChange: (ids: number[]) => void; excludedIds?: number[] }) {
  const [files, setFiles] = useState<ArtifactFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const projectId = Number(window.location.pathname.match(/^\/projects\/(\d+)\//)?.[1] || 0);
  const selected = Array.isArray(value) ? value.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0) : [];
  useEffect(() => {
    let active = true;
    request<ArtifactFile[]>(`/api/artifacts?limit=200${projectId ? `&project_id=${projectId}` : ''}`)
      .then((items) => { if (active) setFiles(items); })
      .catch((exc: unknown) => { if (active) setError(exc instanceof Error ? exc.message : 'فهرست پیوست‌ها بارگذاری نشد.'); });
    return () => { active = false; };
  }, [projectId]);
  const upload = async (file?: File) => {
    if (!file) return;
    if (selected.length >= 20) { setError('حداکثر ۲۰ پیوست مجاز است.'); return; }
    setBusy(true); setError('');
    try {
      const body = new FormData(); body.append('file', file);
      const uploaded = await request<ArtifactFile>(`/api/artifacts/upload?artifact_type=artifact${projectId ? `&project_id=${projectId}` : ''}`,
        { method: 'POST', body, timeoutMs: 300_000 });
      setFiles((current) => [uploaded, ...current]); onChange([...selected, uploaded.id]);
    } catch (exc) { setError(exc instanceof Error ? exc.message : 'بارگذاری پیوست ناموفق بود.'); }
    finally { setBusy(false); }
  };
  const availableFiles = files.filter((item) => !excludedIds.includes(item.id));
  return <div className="data-file-control" dir="rtl">
    <p className="review-attachment-intro"><Paperclip size={15} /> فایل‌های تکمیلی، جدول بودجه و مستندات دیگر را اینجا اضافه کنید.</p>
    <label className="data-file-upload-button"><Upload size={14} /> {busy ? 'در حال بارگذاری...' : 'بارگذاری پیوست'}
      <input hidden type="file" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
    <MultiSelect options={availableFiles.map((file) => ({ value: String(file.id), label: file.original_filename, description: `فایل پیوست · #${file.id}` }))} selected={selected.map(String)} onChange={(ids) => onChange(ids.map(Number))} maxSelected={20} empty="هنوز پیوستی در این پروژه نیست." />
    {error && <small className="data-file-error">{error}</small>}
  </div>;
}
