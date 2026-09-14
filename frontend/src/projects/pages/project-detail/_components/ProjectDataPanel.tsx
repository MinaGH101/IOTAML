import { SqlImporter } from '../../../components/SqlImporter';
import { Upload } from 'lucide-react';
import type { ArtifactUsage, Dataset } from '../../../../shared/types';
import { DatasetUploader } from '../../../components/DatasetUploader';
import { ArtifactUsageSummary } from './ArtifactUsageSummary';

export function ProjectDataPanel({ datasets, usage, canEdit, onUpload, onDelete, projectId, onImported }: { projectId: number; onImported: () => Promise<void>; datasets: Dataset[]; usage: ArtifactUsage | null; canEdit: boolean; onUpload: (file: File) => void; onDelete: (id: number) => void }) {
  return <article className="manager-panel project-data-card project-data-reference">
    <div className="reference-card-head"><div className="reference-step-title"><Upload size={16} /><div><b>داده‌های پروژه</b></div></div></div>
    <DatasetUploader datasets={datasets} onUpload={onUpload} onDelete={onDelete} disabled={!canEdit} disabledText="دسترسی شما به این پروژه فقط مشاهده است." />
    {canEdit && <SqlImporter projectId={projectId} onImported={onImported} />}
    <ArtifactUsageSummary usage={usage} />
  </article>;
}
