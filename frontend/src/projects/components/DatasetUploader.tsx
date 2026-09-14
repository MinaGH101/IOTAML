import { ChevronDown, ChevronUp, Database, HardDrive, Hash, Layers, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import type { Dataset } from '../../shared/types';
import { formatDate } from '../../shared/lib/date';
import { EmptyState, IconButton } from '../../shared/ui';
import { formatBytes } from '../lib/formatBytes';

export function DatasetUploader({ datasets, onUpload, onDelete, disabled = false, disabledText = 'برای آپلود داده، اول پروژه را بسازید.' }: { datasets: Dataset[]; onUpload: (file: File) => void; onDelete: (id: number) => void; disabled?: boolean; disabledText?: string }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  return <div className="dataset-card dataset-card-ai">
    <div className="panel-title compact">دیتاست‌ها</div>
    <label className={`upload-zone upload-zone-ai ${disabled ? 'disabled' : ''}`}><Upload size={18} /><span>{disabled ? disabledText : 'فایل داده را اینجا بکشید یا کلیک کنید'}</span>{!disabled && <small>CSV، TSV، Excel، JSON یا TXT — آماده برای Workflow</small>}<input disabled={disabled} type="file" accept=".csv,.tsv,.xlsx,.xls,.json,.txt,application/json,text/plain" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0])} /></label>
    <div className="datasets-mini datasets-ai-list">
      {datasets.map((dataset) => <DatasetRow key={dataset.id} dataset={dataset} disabled={disabled} open={expandedId === dataset.id} onToggle={() => setExpandedId((id) => id === dataset.id ? null : dataset.id)} onDelete={() => onDelete(dataset.id)} />)}
      {datasets.length === 0 && <EmptyState compact className="dataset-empty-ai">هنوز دیتاستی آپلود نشده است.</EmptyState>}
    </div>
  </div>;
}

function DatasetRow({ dataset, open, disabled, onToggle, onDelete }: { dataset: Dataset; open: boolean; disabled: boolean; onToggle: () => void; onDelete: () => void }) {
  return <article className="dataset-mini-row dataset-row-ai">
    <div className="dataset-row-main-ai"><span className="dataset-icon-ai"><Database size={17} /></span><div><b>{dataset.name}</b><small>{dataset.filename}</small></div></div>
    <div className="dataset-row-meta-ai"><span><Hash size={12} /> {dataset.row_count.toLocaleString('fa-IR')} ردیف</span><span><Layers size={12} /> {dataset.columns.length.toLocaleString('fa-IR')} ستون</span><span><HardDrive size={12} /> {formatBytes(dataset.size_bytes)}</span><span>{formatDate(dataset.created_at)}</span></div>
    <div className="dataset-row-actions-ai"><IconButton className="tiny-icon" aria-label="نمایش ستون‌ها" title="نمایش ستون‌ها" icon={open ? <ChevronUp size={13} /> : <ChevronDown size={13} />} onClick={onToggle} />{!disabled && <IconButton className="tiny-icon danger" variant="danger" aria-label="حذف دیتاست" title="حذف دیتاست" icon={<Trash2 size={12} />} onClick={onDelete} />}</div>
    {open && <div className="dataset-columns-ai"><div className="dataset-columns-head-ai"><span>نام ستون</span><span>نوع</span><span>خالی</span><span>یکتا</span></div>{dataset.columns.slice(0, 8).map((column) => <div className="dataset-column-row-ai" key={column.name}><span>{column.name}</span><span>{column.dtype}</span><span>{column.missing.toLocaleString('fa-IR')}</span><span>{column.unique.toLocaleString('fa-IR')}</span></div>)}{dataset.columns.length > 8 && <small className="dataset-more-ai">+{(dataset.columns.length - 8).toLocaleString('fa-IR')} ستون دیگر</small>}</div>}
  </article>;
}
