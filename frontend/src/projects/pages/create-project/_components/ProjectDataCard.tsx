import { Info } from 'lucide-react';
import type { Dataset } from '../../../../shared/types';
import { EmptyState } from '../../../../shared/ui';
import { DatasetUploader } from '../../../components/DatasetUploader';

export function ProjectDataCard({ projectCreated, datasets, uploading, onUpload, onDelete }: {
  projectCreated: boolean; datasets: Dataset[]; uploading: boolean;
  onUpload: (file: File) => void; onDelete: (id: number) => void;
}) {
  return <article className="manager-panel project-create-card-reference">
    <div className="reference-card-head"><div className="reference-step-title"><span className={`step-number-ai ${projectCreated || datasets.length ? 'active' : ''}`}>۲</span><div><b>داده‌های پروژه</b></div></div></div>
    {!projectCreated && <div className="info-note-reference"><Info size={15} /> اگر پروژه هنوز ساخته نشده باشد، قبل از آپلود خودکار ساخته می‌شود.</div>}
    {uploading && <EmptyState compact>در حال آپلود...</EmptyState>}
    <DatasetUploader datasets={datasets} onUpload={onUpload} onDelete={onDelete} />
  </article>;
}
