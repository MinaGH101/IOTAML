import { useEffect, useMemo, useState } from 'react';
import { AppDialog } from './AppDialog';
import type { ComponentBoundaryPort, ExposedComponentParameter } from '../types';

export type ComponentDefinitionDraft = {
  name: string;
  description: string;
  semanticVersion: string;
  visibility: 'private' | 'project' | 'organization';
  inputs: ComponentBoundaryPort[];
  outputs: ComponentBoundaryPort[];
  exposedParameters: ExposedComponentParameter[];
};

type CreateComponentDialogProps = {
  open: boolean;
  busy: boolean;
  selectedCount: number;
  initialInputs: ComponentBoundaryPort[];
  initialOutputs: ComponentBoundaryPort[];
  onClose: () => void;
  onCreate: (draft: ComponentDefinitionDraft) => void;
};

function PortRows({ label, ports, onChange }: { label: string; ports: ComponentBoundaryPort[]; onChange: (ports: ComponentBoundaryPort[]) => void }) {
  return (
    <div className="component-port-editor">
      <div className="component-port-editor-title"><b>{label}</b><small>{ports.length} پورت</small></div>
      {ports.length === 0 && <div className="empty-state small">اتصال مرزی برای این بخش وجود ندارد.</div>}
      {ports.map((port, index) => (
        <div className="component-port-row" key={port.id}>
          <input value={port.name} aria-label={`نام ${label}`} onChange={(event) => onChange(ports.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
          <select value={port.type} aria-label={`نوع ${label}`} onChange={(event) => onChange(ports.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value } : item))}>
            {['any', 'dataframe', 'json', 'json_items', 'model', 'metrics', 'plot', 'file', 'report', 'artifact_ref', 'text', 'schema'].map((type) => <option value={type} key={type}>{type}</option>)}
          </select>
          <label className="component-port-required"><input type="checkbox" checked={port.required} onChange={(event) => onChange(ports.map((item, itemIndex) => itemIndex === index ? { ...item, required: event.target.checked } : item))} /> الزامی</label>
        </div>
      ))}
    </div>
  );
}

export function CreateComponentDialog({ open, busy, selectedCount, initialInputs, initialOutputs, onClose, onCreate }: CreateComponentDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [semanticVersion, setSemanticVersion] = useState('1.0.0');
  const [visibility, setVisibility] = useState<'private' | 'project' | 'organization'>('private');
  const [inputs, setInputs] = useState<ComponentBoundaryPort[]>(initialInputs);
  const [outputs, setOutputs] = useState<ComponentBoundaryPort[]>(initialOutputs);
  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setSemanticVersion('1.0.0');
    setVisibility('private');
    setInputs(initialInputs);
    setOutputs(initialOutputs);
  }, [initialInputs, initialOutputs, open]);
  const valid = name.trim().length > 0 && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(semanticVersion);
  return (
    <AppDialog open={open} title="ساخت کامپوننت قابل استفاده مجدد" description={`${selectedCount} نود انتخاب‌شده به یک کامپوننت نسخه‌دار تبدیل می‌شوند.`} width={760} onClose={onClose} closeDisabled={busy} footer={<>
      <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>انصراف</button>
      <button type="button" className="primary-button" disabled={busy || !valid} onClick={() => onCreate({ name: name.trim(), description: description.trim(), semanticVersion, visibility, inputs, outputs, exposedParameters: [] })}>{busy ? 'در حال ساخت…' : 'ساخت و جایگزینی'}</button>
    </>}>
      <div className="app-dialog-grid two-columns">
        <label className="app-dialog-field"><span>نام کامپوننت</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="مثلاً Geochemical Preprocessing" /></label>
        <label className="app-dialog-field"><span>نسخه اولیه</span><input dir="ltr" value={semanticVersion} onChange={(event) => setSemanticVersion(event.target.value)} placeholder="1.0.0" /></label>
      </div>
      <label className="app-dialog-field"><span>توضیحات</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="هدف، ورودی مورد انتظار و خروجی این کامپوننت" /></label>
      <label className="app-dialog-field"><span>دسترسی</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}><option value="private">خصوصی برای من</option><option value="project">اشتراک در این پروژه</option><option value="organization">اشتراک سازمانی</option></select></label>
      <div className="component-interface-grid"><PortRows label="ورودی‌ها" ports={inputs} onChange={setInputs} /><PortRows label="خروجی‌ها" ports={outputs} onChange={setOutputs} /></div>
      <div className="component-dialog-note">پارامترهای داخلی به‌صورت پیش‌فرض مخفی می‌مانند. پس از ساخت، از ویرایشگر داخلی می‌توانید پارامترهای مورد نیاز را در نسخه بعدی منتشر کنید.</div>
    </AppDialog>
  );
}

type ComponentVersionDialogProps = {
  open: boolean;
  busy: boolean;
  currentVersion: string;
  onClose: () => void;
  onSave: (semanticVersion: string, changelog: string) => void;
};

function suggestNextVersion(current: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(current);
  if (!match) return '1.0.1';
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

export function ComponentVersionDialog({ open, busy, currentVersion, onClose, onSave }: ComponentVersionDialogProps) {
  const suggestion = useMemo(() => suggestNextVersion(currentVersion), [currentVersion]);
  const [version, setVersion] = useState(suggestion);
  const [changelog, setChangelog] = useState('');
  useEffect(() => { if (open) { setVersion(suggestion); setChangelog(''); } }, [open, suggestion]);
  const valid = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version);
  return (
    <AppDialog open={open} title="ذخیره نسخه جدید کامپوننت" description="نسخه‌های قبلی تغییر نمی‌کنند و جریان‌های موجود همچنان به نسخه قبلی متصل می‌مانند." onClose={onClose} closeDisabled={busy} footer={<>
      <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>انصراف</button>
      <button type="button" className="primary-button" disabled={busy || !valid} onClick={() => onSave(version, changelog.trim())}>{busy ? 'در حال ذخیره…' : 'ذخیره نسخه'}</button>
    </>}>
      <label className="app-dialog-field"><span>Semantic version</span><input autoFocus dir="ltr" value={version} onChange={(event) => setVersion(event.target.value)} /></label>
      <label className="app-dialog-field"><span>شرح تغییرات</span><textarea rows={4} value={changelog} onChange={(event) => setChangelog(event.target.value)} placeholder="پارامترها، نودها یا رفتار تغییر‌یافته" /></label>
    </AppDialog>
  );
}
