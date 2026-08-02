import { useRef, useState } from 'react';
import { FileSpreadsheet, Trash2, Upload } from 'lucide-react';

export type UploadedTableFile = { name: string; mime_type: string; size: number; data_url: string };

function uploadedTableFile(value: unknown): UploadedTableFile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Partial<UploadedTableFile>;
  if (!item.name || !item.data_url) return null;
  return { name: String(item.name), mime_type: String(item.mime_type || 'application/octet-stream'), size: Number(item.size || 0), data_url: String(item.data_url) };
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataFileInput({ value, onChange, help }: { value: unknown; onChange: (value: UploadedTableFile | null) => void; help?: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState('');
  const current = uploadedTableFile(value);
  const choose = (file?: File) => {
    if (!file) return;
    setError('');
    if (file.size > 2 * 1024 * 1024) {
      setError('Mapping files must be 2 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange({ name: file.name, mime_type: file.type || 'application/octet-stream', size: file.size, data_url: String(reader.result || '') });
    reader.readAsDataURL(file);
  };
  return (
    <div className="data-file-control workflow-shell-card">
      <input ref={inputRef} hidden type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { choose(event.target.files?.[0]); event.currentTarget.value = ''; }} />
      {current ? (
        <div className="data-file-summary">
          <FileSpreadsheet size={17} />
          <span><b dir="ltr">{current.name}</b><small>{formatFileSize(current.size)}</small></span>
          <button type="button" className="tiny-action icon-only" title="Replace file" aria-label="Replace file" onClick={() => inputRef.current?.click()}><Upload size={13} /></button>
          <button type="button" className="tiny-action icon-only topbar-danger-action" title="Remove file" aria-label="Remove file" onClick={() => onChange(null)}><Trash2 size={13} /></button>
        </div>
      ) : (
        <button type="button" className="data-file-upload-button" onClick={() => inputRef.current?.click()}><Upload size={14} /> Upload CSV / XLSX mapping</button>
      )}
      {error && <small className="data-file-error">{error}</small>}
      <small>{help || 'The file is stored with this workflow. Use a compact two-column mapping table.'}</small>
    </div>
  );
}
