import { Check, Download, ExternalLink, GitBranch, RefreshCw, Trash2 } from 'lucide-react';
import { AppDialog } from './AppDialog';
import type { ComponentVersionSummary, WorkflowComponent } from '../types';

export type ComponentVersionAction = {
  component: WorkflowComponent;
  version: ComponentVersionSummary;
};

type Props = {
  open: boolean;
  component: WorkflowComponent | null;
  versions: ComponentVersionSummary[];
  busy: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onOpenVersion: (action: ComponentVersionAction) => void;
  onMakeCurrent: (action: ComponentVersionAction) => void;
  onExportVersion: (action: ComponentVersionAction) => void;
  onDeleteVersion: (action: ComponentVersionAction) => void;
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ComponentVersionsDialog({ open, component, versions, busy, onClose, onRefresh, onOpenVersion, onMakeCurrent, onExportVersion, onDeleteVersion }: Props) {
  return (
    <AppDialog
      open={open}
      title={component ? `نسخه‌های ${component.name}` : 'نسخه‌های کامپوننت'}
      description="هر جریان به نسخه مشخصی متصل می‌ماند. تغییر نسخه جاری، جریان‌های موجود را خودکار ارتقا نمی‌دهد."
      width={760}
      onClose={onClose}
      footer={<>
        <button type="button" className="secondary-button" onClick={onClose}>بستن</button>
        <button type="button" className="secondary-button" disabled={busy || !component} onClick={onRefresh}><RefreshCw size={14}/> به‌روزرسانی</button>
      </>}
    >
      <div className="component-version-manager-list">
        {component && versions.map((version) => {
          const current = component.current_version_id === version.id;
          const action = { component, version };
          return (
            <article className={`component-version-manager-row ${current ? 'current' : ''}`} key={version.id}>
              <div className="component-version-manager-main">
                <span className="component-version-badge"><GitBranch size={14}/> v{version.semantic_version}</span>
                <div>
                  <b>{current ? 'نسخه جاری' : `نسخه ${version.version_number}`}</b>
                  <small>{formatDate(version.created_at)}</small>
                  <small>{version.changelog || 'بدون توضیح تغییرات'}</small>
                  <small className="component-version-hash">{version.graph_hash.slice(0, 12)}</small>
                </div>
              </div>
              <div className="component-version-manager-actions">
                <button type="button" className="workflow-tab-icon-button" disabled={busy} onClick={() => onOpenVersion(action)} title="باز کردن و ویرایش به‌عنوان نسخه جدید" aria-label="باز کردن نسخه"><ExternalLink size={15}/></button>
                <button type="button" className="workflow-tab-icon-button" disabled={busy || current} onClick={() => onMakeCurrent(action)} title={current ? 'این نسخه جاری است' : 'انتخاب به‌عنوان نسخه جاری'} aria-label="نسخه جاری"><Check size={15}/></button>
                <button type="button" className="workflow-tab-icon-button" disabled={busy} onClick={() => onExportVersion(action)} title="خروجی این نسخه" aria-label="خروجی نسخه"><Download size={15}/></button>
                <button type="button" className="workflow-tab-icon-button workflow-version-delete" disabled={busy || current} onClick={() => onDeleteVersion(action)} title={current ? 'نسخه جاری قابل حذف نیست' : 'حذف نسخه'} aria-label="حذف نسخه"><Trash2 size={15}/></button>
              </div>
            </article>
          );
        })}
        {component && versions.length === 0 && <div className="empty-state small">نسخه‌ای برای این کامپوننت پیدا نشد.</div>}
      </div>
    </AppDialog>
  );
}
