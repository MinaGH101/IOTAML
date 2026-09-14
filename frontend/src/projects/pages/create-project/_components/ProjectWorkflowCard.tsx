import { Check, FileUp, Info, PlusCircle } from 'lucide-react';
import { useRef } from 'react';
import type { Project, Workflow } from '../../../../shared/types';
import { Button, EmptyState, Field, Input } from '../../../../shared/ui';
import { WorkflowCard } from '../../../components/workflows/WorkflowCard';

export function ProjectWorkflowCard({ project, workflows, name, creating, importing, onNameChange, onCreate, onImport, onOpen }: {
  project: Project | null; workflows: Workflow[]; name: string; creating: boolean; importing: boolean;
  onNameChange: (value: string) => void; onCreate: () => void; onImport: (file: File) => void; onOpen: (workflow: Workflow) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return <article className="manager-panel project-create-card-reference">
    <div className="reference-card-head workflow-reference-head">
      <div className="reference-step-title"><span className={`step-number-ai ${workflows.length ? 'done' : project ? 'active' : ''}`}>{workflows.length ? <Check size={13} /> : '۳'}</span><div><b>جریان‌های پروژه</b><span>بعد از ساخت پروژه، یک workflow اولیه بسازید.</span></div></div>
      <div className="workflow-create-actions">
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) onImport(file); e.currentTarget.value = ''; }} />
        <Button loading={importing} leadingIcon={<FileUp size={15} />} onClick={() => fileRef.current?.click()}>Import JSON</Button>
        <Button variant="primary" loading={creating} leadingIcon={<PlusCircle size={15} />} onClick={onCreate}>جریان جدید</Button>
      </div>
    </div>
    <div className="workflow-name-reference">
      <Field label="نام جریان کاری"><Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="مثلاً جریان IOTA ML" /></Field>
      {!project && <div className="info-note-reference"><Info size={15} /> با کلیک روی «جریان جدید»، پروژه ابتدا ساخته می‌شود و سپس Workflow ایجاد می‌شود.</div>}
    </div>
    <div className="workflow-card-grid workflow-card-grid-ai workflow-grid-reference">
      {workflows.map((workflow) => <WorkflowCard key={workflow.id} workflow={workflow} onOpen={() => onOpen(workflow)} />)}
      {workflows.length === 0 && <EmptyState compact>هنوز جریانی برای این پروژه ذخیره نشده است.</EmptyState>}
    </div>
  </article>;
}
