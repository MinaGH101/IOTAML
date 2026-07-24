import { memo, type CSSProperties } from 'react';
import {
  ArrowLeft,
  Download,
  KanbanSquare,
  Layers3,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Pencil,
  Play,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Square,
  Trash2,
  UserCircle,
} from 'lucide-react';
import { ThemeToggle } from '../../../../shared/_components/ThemeToggle';

type WorkflowHeaderProps = {
  floatingTopbarStyle: CSSProperties;
  topbarLeftStyle: CSSProperties;
  topbarCenterStyle: CSSProperties;
  topbarRightStyle: CSSProperties;
  onLogout: () => void;
  onProfile: () => void;
  onProjects: () => void;
  onCancelRun: () => void;
  runActive: boolean;
  onExport: () => void;
  onLayout: () => void;
  onCreateComponent: () => void;
  createComponentDisabled: boolean;
  readOnly: boolean;
  runDisabled: boolean;
  runSelectedNode: boolean;
  runBusy: boolean;
  onRun: () => void;
  boardOpen: boolean;
  onToggleBoard: () => void;
  saveDisabled: boolean;
  versionBusy: boolean;
  onSaveVersion: () => void;
  onRenameBoard: () => void;
  onDeleteBoard: () => void;
  activeBoardIsMain: boolean;
  autosaveState: string;
  autosaveUpdatedAt: string | null;
  autosaveLabel: string;
  projectName: string;
  workflowName: string;
  onProject: () => void;
};

export const WorkflowHeader = memo(function WorkflowHeader({
  floatingTopbarStyle,
  topbarLeftStyle,
  topbarCenterStyle,
  topbarRightStyle,
  onLogout,
  onProfile,
  onProjects,
  onCancelRun,
  runActive,
  onExport,
  onLayout,
  onCreateComponent,
  createComponentDisabled,
  readOnly,
  runDisabled,
  runSelectedNode,
  runBusy,
  onRun,
  boardOpen,
  onToggleBoard,
  saveDisabled,
  versionBusy,
  onSaveVersion,
  onRenameBoard,
  onDeleteBoard,
  activeBoardIsMain,
  autosaveState,
  autosaveUpdatedAt,
  autosaveLabel,
  projectName,
  workflowName,
  onProject,
}: WorkflowHeaderProps) {
  return (
    <header className="topbar workflow-topbar workflow-topbar-pro" dir="ltr" style={floatingTopbarStyle}>
      <div className="workflow-topbar-left" style={topbarLeftStyle}>
        <button className="icon-button icon-only topbar-danger-action" type="button" onClick={onLogout} title="خروج" aria-label="خروج"><LogOut size={17}/></button>
        <button className="icon-button icon-only" type="button" onClick={onProfile} title="پروفایل" aria-label="پروفایل"><UserCircle size={17}/></button>
        <ThemeToggle />
        <button className="icon-button icon-only" type="button" onClick={onProjects} title="پنل پروژه‌ها" aria-label="پنل پروژه‌ها"><LayoutDashboard size={17}/></button>
        {runActive && <button className="icon-button icon-only topbar-danger-action" type="button" onClick={onCancelRun} title="توقف اجرا" aria-label="توقف اجرا"><Square size={13} /></button>}
        <button className="icon-button icon-only" type="button" onClick={onExport} title="Export workflow JSON" aria-label="Export workflow JSON"><Download size={17}/></button>
        <button className="icon-button icon-only" type="button" disabled={readOnly} onClick={onLayout} title="چیدمان خودکار" aria-label="چیدمان خودکار"><LayoutGrid size={17}/></button>
        <button className="icon-button icon-only" type="button" disabled={createComponentDisabled} onClick={onCreateComponent} title="تبدیل نودهای انتخاب‌شده به کامپوننت" aria-label="ساخت کامپوننت"><Layers3 size={17}/></button>
      </div>
      <div className="workflow-topbar-center" style={topbarCenterStyle}>
        <button className="icon-button icon-only topbar-primary-action" title={runSelectedNode ? 'اجرای مسیر نود انتخاب‌شده' : 'اجرای برد'} aria-label="اجرا" disabled={runDisabled} onClick={onRun}>{runBusy ? <RefreshCw size={17} className="spin" /> : <Play size={17}/>}</button>
        <button className={`icon-button icon-only ${boardOpen ? 'active' : ''}`} type="button" onClick={onToggleBoard} title={boardOpen ? 'بازگشت به Workflow' : 'Analysis Board'} aria-label={boardOpen ? 'بازگشت به Workflow' : 'Analysis Board'}><KanbanSquare size={17}/></button>
        <button className="icon-button icon-only topbar-primary-action" type="button" disabled={saveDisabled} onClick={onSaveVersion} title="ذخیره نسخه نام‌گذاری‌شده" aria-label="ذخیره نسخه نام‌گذاری‌شده">{versionBusy ? <RefreshCw size={17} className="spin" /> : <Save size={17}/>}</button>
        {boardOpen && <button className="icon-button icon-only" type="button" disabled={readOnly} onClick={onRenameBoard} title="تغییر نام برد فعال" aria-label="تغییر نام برد فعال"><Pencil size={17}/></button>}
        {boardOpen && <button className="icon-button icon-only topbar-danger-action" type="button" disabled={readOnly || activeBoardIsMain} onClick={onDeleteBoard} title={activeBoardIsMain ? 'برد اصلی قابل حذف نیست' : 'حذف برد فعال'} aria-label="حذف برد فعال"><Trash2 size={17}/></button>}
      </div>
      <div className="workflow-topbar-right" style={topbarRightStyle}>
        <span className={`workflow-autosave-status ${autosaveState} ${readOnly ? 'preview' : ''}`} title={autosaveUpdatedAt ? `آخرین ذخیره: ${new Date(autosaveUpdatedAt).toLocaleString('fa-IR')}` : autosaveLabel}>{autosaveLabel}</span>
        <div className="workflow-breadcrumb workflow-logo-breadcrumb" dir="rtl">
          <div className="workflow-logo-title"><img src="/iota.png" alt="IOTA" /><h2>IOTA ML</h2></div>
          <h1>›</h1>
          <button type="button" className="workflow-project-link" onClick={onProject} title="بازگشت به صفحه پروژه">{projectName}</button>
          <h1>›</h1>
          <span className="workflow-current-name" title={workflowName}>{workflowName}</span>
        </div>
      </div>
    </header>
  );
});

export const ComponentEditorBanner = memo(function ComponentEditorBanner({
  workflowName,
  componentName,
  semanticVersion,
  dirty,
  busy,
  onEditDefinition,
  onLeave,
  onSaveVersion,
}: {
  workflowName: string;
  componentName: string;
  semanticVersion: string;
  dirty: boolean;
  busy: boolean;
  onEditDefinition: () => void;
  onLeave: () => void;
  onSaveVersion: () => void;
}) {
  return (
    <div className="component-editor-banner workflow-shell-card" dir="rtl">
      <div className="component-editor-breadcrumb"><Layers3 size={17}/><span>{workflowName}</span><b>›</b><strong>{componentName}</strong><small>v{semanticVersion}{dirty ? ' · تغییر ذخیره‌نشده' : ''}</small></div>
      <div className="component-editor-actions">
        <button type="button" className="secondary-button compact" disabled={busy} onClick={onEditDefinition}><SlidersHorizontal size={15}/> پورت‌ها و پارامترها</button>
        <button type="button" className="secondary-button compact" onClick={onLeave}><ArrowLeft size={15}/> بازگشت به جریان</button>
        <button type="button" className="primary-button compact" disabled={busy} onClick={onSaveVersion}><Save size={15}/> ذخیره نسخه جدید</button>
      </div>
    </div>
  );
});
