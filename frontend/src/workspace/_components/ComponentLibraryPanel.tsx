import { Archive, Download, ExternalLink, FileUp, GitBranch, Layers3, RefreshCw, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import type { WorkflowComponent } from '../../shared/_types';

type Props = {
  components: WorkflowComponent[];
  busy: boolean;
  onRefresh: () => void;
  onEdit: (component: WorkflowComponent) => void;
  onManageVersions: (component: WorkflowComponent) => void;
  onExport: (component: WorkflowComponent) => void;
  onArchive: (component: WorkflowComponent) => void;
  onDelete: (component: WorkflowComponent) => void;
  onImport: (payload: Record<string, unknown>) => void;
};

export function ComponentLibraryPanel({ components, busy, onRefresh, onEdit, onManageVersions, onExport, onArchive, onDelete, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const readImport = async (file: File | undefined) => {
    if (!file) return;
    const payload = JSON.parse(await file.text()) as Record<string, unknown>;
    onImport(payload);
    if (fileRef.current) fileRef.current.value = '';
  };
  return (
    <section className="component-library-panel">
      <div className="workflow-versions-header">
        <div><b>کتابخانه کامپوننت‌ها</b><small>قابل استفاده در همه جریان‌ها و پروژه‌ها</small></div>
        <div className="component-library-header-actions">
          <input ref={fileRef} hidden type="file" accept="application/json,.json,.iotacomp" onChange={(event) => { void readImport(event.target.files?.[0]); }} />
          <button type="button" className="workflow-tab-icon-button" disabled={busy} onClick={() => fileRef.current?.click()} title="Import component" aria-label="Import component"><FileUp size={16}/></button>
          <button type="button" className="workflow-tab-icon-button" disabled={busy} onClick={onRefresh} title="به‌روزرسانی" aria-label="به‌روزرسانی"><RefreshCw size={16}/></button>
        </div>
      </div>
      <div className="component-library-list">
        {components.map((component) => (
          <article className="component-library-row" key={component.id}>
            <button type="button" className="component-library-main" onClick={() => onEdit(component)}>
              <span className="component-library-icon"><Layers3 size={17}/></span>
              <span><b>{component.name}</b><small>{component.current_version ? `v${component.current_version.semantic_version}` : 'بدون نسخه'} · {component.usage_count} استفاده</small><small>{component.description || 'بدون توضیح'}</small></span>
              <ExternalLink size={14}/>
            </button>
            <div className="component-library-actions">
              <button type="button" className="workflow-tab-icon-button" disabled={busy} onClick={() => onManageVersions(component)} title="مدیریت نسخه‌ها" aria-label="مدیریت نسخه‌ها"><GitBranch size={14}/></button>
              <button type="button" className="workflow-tab-icon-button" disabled={busy} onClick={() => onExport(component)} title="خروجی بسته کامپوننت" aria-label="خروجی"><Download size={14}/></button>
              <button type="button" className="workflow-tab-icon-button" disabled={busy} onClick={() => onArchive(component)} title={component.archived ? 'فعال‌سازی' : 'آرشیو'} aria-label="آرشیو"><Archive size={14}/></button>
              <button type="button" className="workflow-tab-icon-button workflow-version-delete" disabled={busy || component.usage_count > 0} onClick={() => onDelete(component)} title={component.usage_count > 0 ? 'کامپوننت در حال استفاده است و باید آرشیو شود' : 'حذف کامپوننت'} aria-label="حذف"><Trash2 size={14}/></button>
            </div>
          </article>
        ))}
        {components.length === 0 && <div className="empty-state small">هنوز کامپوننتی نساخته‌اید. چند نود متصل را انتخاب کنید و دکمه Group را بزنید.</div>}
      </div>
    </section>
  );
}
