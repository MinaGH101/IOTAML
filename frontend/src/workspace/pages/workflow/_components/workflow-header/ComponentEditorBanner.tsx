import { memo } from 'react';
import { ArrowLeft, Layers3, Save, SlidersHorizontal } from 'lucide-react';
export const ComponentEditorBanner = memo(function ComponentEditorBanner({ workflowName, componentName, semanticVersion, dirty, busy, onEditDefinition, onLeave, onSaveVersion }: {
    workflowName: string;
    componentName: string;
    semanticVersion: string;
    dirty: boolean;
    busy: boolean;
    onEditDefinition: () => void;
    onLeave: () => void;
    onSaveVersion: () => void;
}) { return <div className="component-editor-banner workflow-shell-card" dir="rtl"><div className="component-editor-breadcrumb"><Layers3 size={17}/><span>{workflowName}</span><b>›</b><strong>{componentName}</strong><small>v{semanticVersion}{dirty ? ' · تغییر ذخیره‌نشده' : ''}</small></div><div className="component-editor-actions"><button type="button" className="secondary-button compact" disabled={busy} onClick={onEditDefinition}><SlidersHorizontal size={15}/> پورت‌ها و پارامترها</button><button type="button" className="secondary-button compact" onClick={onLeave}><ArrowLeft size={15}/> بازگشت به جریان</button><button type="button" className="primary-button compact" disabled={busy} onClick={onSaveVersion}><Save size={15}/> ذخیره نسخه جدید</button></div></div>; });
