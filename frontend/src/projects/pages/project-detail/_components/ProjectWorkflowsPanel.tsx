import { FileUp, PlusCircle } from 'lucide-react';
import { useRef } from 'react';
import type { Project, Workflow } from '../../../../shared/types';
import { Button, EmptyState, Input } from '../../../../shared/ui';
import type { useWorkflowManagement } from '../_hooks/useWorkflowManagement';
type WorkflowManager = ReturnType<typeof useWorkflowManagement>;
import { WorkflowManageCard } from './WorkflowManageCard';

export function ProjectWorkflowsPanel({ project, workflows, manager, onOpenEditor }: { project: Project; workflows: Workflow[]; manager: WorkflowManager; onOpenEditor: (id: number | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return <article className="manager-panel workflows-reference-card">
    <div className="reference-card-head workflow-reference-head"><div><b>جریان‌های پروژه</b></div>
      {project.can_edit && <div className="workflow-create-actions"><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) manager.importFile(file); e.currentTarget.value = ''; }} /><Button loading={manager.importing} leadingIcon={<FileUp size={15} />} onClick={() => fileRef.current?.click()}>Import JSON</Button><Button variant="primary" loading={manager.creating} leadingIcon={<PlusCircle size={15} />} onClick={manager.create}>جریان جدید</Button></div>}
    </div>
    {project.can_edit && <label className="workflow-create-name"><span>نام جریان جدید</span><Input value={manager.newName} maxLength={255} placeholder="مثلاً تحلیل فروش" onChange={(event) => manager.setNewName(event.target.value)} /></label>}
    <div className="workflow-card-grid workflow-card-grid-reference">
      {workflows.map((workflow) => <WorkflowManageCard key={workflow.id} workflow={workflow} canEdit={project.can_edit} editing={manager.editingId === workflow.id} busy={manager.actionId === workflow.id} draft={manager.drafts[workflow.id] ?? workflow.name} onOpen={() => onOpenEditor(workflow.id)} onEdit={() => manager.setEditingId(workflow.id)} onDraft={(name) => manager.setDrafts((items) => ({ ...items, [workflow.id]: name }))} onSave={() => manager.saveName(workflow)} onCancel={() => manager.cancelEdit(workflow)} onDelete={() => manager.setDeleteTarget(workflow)} />)}
      {workflows.length === 0 && <EmptyState compact>هنوز جریانی برای این پروژه ذخیره نشده است.</EmptyState>}
    </div>
  </article>;
}
