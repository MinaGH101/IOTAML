import { useState } from 'react';
import { ChevronDown, ChevronUp, Database, HardDrive, Hash, Layers, Trash2, Upload } from 'lucide-react';
import type { Dataset } from '../types';
import { formatDate } from '../utils/appShared';

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '۰ بایت';
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toLocaleString('fa-IR', { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
};

export function DatasetUploader({
  datasets,
  onUpload,
  onDelete,
  disabled = false,
  disabledText = 'برای آپلود داده، اول پروژه را بسازید.'
}: {
  datasets: Dataset[];
  onUpload: (file: File) => void;
  onDelete: (id: number) => void;
  disabled?: boolean;
  disabledText?: string;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="dataset-card dataset-card-ai">
      <div className="panel-title compact">دیتاست‌ها</div>
      <label className={`upload-zone upload-zone-ai ${disabled ? 'disabled' : ''}`}>
        <Upload size={18} />
        <span>{disabled ? disabledText : 'فایل CSV را اینجا بکشید یا کلیک کنید'}</span>
        {!disabled && <small>فرمت CSV — آماده برای Workflow</small>}
        <input disabled={disabled} type="file" accept=".csv" onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0])} />
      </label>

      <div className="datasets-mini datasets-ai-list">
        {datasets.map((dataset) => {
          const isOpen = expandedId === dataset.id;
          return (
            <article key={dataset.id} className="dataset-mini-row dataset-row-ai">
              <div className="dataset-row-main-ai">
                <span className="dataset-icon-ai"><Database size={17} /></span>
                <div>
                  <b>{dataset.name}</b>
                  <small>{dataset.filename}</small>
                </div>
              </div>

              <div className="dataset-row-meta-ai">
                <span><Hash size={12} /> {dataset.row_count.toLocaleString('fa-IR')} ردیف</span>
                <span><Layers size={12} /> {dataset.columns.length.toLocaleString('fa-IR')} ستون</span>
                <span><HardDrive size={12} /> {formatBytes(dataset.size_bytes)}</span>
                <span>{formatDate(dataset.created_at)}</span>
              </div>

              <div className="dataset-row-actions-ai">
                <button type="button" className="tiny-icon" title="نمایش ستون‌ها" onClick={() => setExpandedId(isOpen ? null : dataset.id)}>
                  {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                <button type="button" className="tiny-icon danger" title="حذف دیتاست" aria-label="حذف دیتاست" onClick={() => onDelete(dataset.id)}>
                  <Trash2 size={12} />
                </button>
              </div>

              {isOpen && (
                <div className="dataset-columns-ai">
                  <div className="dataset-columns-head-ai"><span>نام ستون</span><span>نوع</span><span>خالی</span><span>یکتا</span></div>
                  {dataset.columns.slice(0, 8).map((column) => (
                    <div className="dataset-column-row-ai" key={column.name}>
                      <span>{column.name}</span>
                      <span>{column.dtype}</span>
                      <span>{column.missing.toLocaleString('fa-IR')}</span>
                      <span>{column.unique.toLocaleString('fa-IR')}</span>
                    </div>
                  ))}
                  {dataset.columns.length > 8 && <small className="dataset-more-ai">+{(dataset.columns.length - 8).toLocaleString('fa-IR')} ستون دیگر</small>}
                </div>
              )}
            </article>
          );
        })}
        {datasets.length === 0 && <div className="empty-state small dataset-empty-ai">هنوز دیتاستی آپلود نشده است.</div>}
      </div>
    </div>
  );
}
