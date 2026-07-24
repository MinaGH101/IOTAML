import { Check, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import type { WorkflowVersionSummary } from '../../../../shared/_types';
import { formatDateTime } from '../../../../shared/_utils/appShared';

export function WorkflowVersionsPanel({
  versions,
  workflowId,
  selectedVersionId,
  previewActive,
  busy,
  onSelect,
  onRestore,
  onDelete,
  onRefresh,
  onReturnToCurrent,
}: {
  versions: WorkflowVersionSummary[];
  workflowId: number | null;
  selectedVersionId: number | null;
  previewActive: boolean;
  busy: boolean;
  onSelect: (version: WorkflowVersionSummary) => void;
  onRestore: (version: WorkflowVersionSummary) => void;
  onDelete: (version: WorkflowVersionSummary) => void;
  onRefresh: () => void;
  onReturnToCurrent: () => void;
}) {
  const selected = versions.find((item) => item.id === selectedVersionId) || null;
  return (
    <section className="workflow-versions-panel">
      <div className="workflow-tab-content-head">
        <span>نسخه‌های نام‌گذاری‌شده</span>
        <button type="button" className="workflow-tab-icon-button" disabled={!workflowId} onClick={onRefresh} title="به‌روزرسانی نسخه‌ها" aria-label="به‌روزرسانی نسخه‌ها"><RefreshCw size={17}/></button>
      </div>
      {previewActive && (
        <div className="workflow-version-preview-banner">
          <div>
            <b>نمایش نسخه ذخیره‌شده</b>
            <small>{selected ? `${selected.name} · v${selected.version_number}` : 'نسخه انتخاب‌شده'}</small>
          </div>
          <div className="workflow-version-preview-actions">
            <button type="button" className="workflow-tab-icon-button" onClick={onReturnToCurrent} title="بازگشت به آخرین نسخه خودکار" aria-label="بازگشت به آخرین نسخه خودکار"><Undo2 size={16}/></button>
            {selected && <button type="button" className="workflow-tab-icon-button active" disabled={busy} onClick={() => onRestore(selected)} title="بازیابی به‌عنوان نسخه جاری" aria-label="بازیابی به‌عنوان نسخه جاری"><Check size={16}/></button>}
          </div>
        </div>
      )}
      <div className="workflow-version-list">
        {versions.map((version) => (
          <div key={version.id} className={`workflow-version-row ${selectedVersionId === version.id ? 'active' : ''}`}>
            <button type="button" className="workflow-version-main" onClick={() => onSelect(version)}>
              <span className="workflow-version-number">v{version.version_number}</span>
              <b>{version.name}</b>
              <small>{formatDateTime(version.created_at)} · draft r{version.source_revision}</small>
              {version.description && <small>{version.description}</small>}
              {version.run_id && <small>Run #{version.run_id}</small>}
            </button>
            <button type="button" className="workflow-tab-icon-button workflow-version-delete" disabled={busy} onClick={() => onDelete(version)} title="حذف نسخه" aria-label="حذف نسخه"><Trash2 size={15}/></button>
          </div>
        ))}
        {!workflowId && <div className="empty-state small">ابتدا جریان به‌صورت خودکار ذخیره می‌شود، سپس می‌توانید نسخه نام‌گذاری‌شده بسازید.</div>}
        {workflowId && versions.length === 0 && <div className="empty-state small">هنوز نسخه نام‌گذاری‌شده‌ای ذخیره نشده است. دکمه Save بالای صفحه یک نسخه ثابت ایجاد می‌کند.</div>}
      </div>
    </section>
  );
}
