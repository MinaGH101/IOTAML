import { Pencil, Save, Trash2, X } from 'lucide-react';
import type { Workflow } from '../../../../shared/types';
import { formatDate } from '../../../../shared/lib/date';
import { IconButton, Input } from '../../../../shared/ui';
import { WorkflowIcon } from '../../../components/workflows/WorkflowCard';

type Props = { workflow: Workflow; canEdit: boolean; editing: boolean; busy: boolean; draft: string; onOpen: () => void; onEdit: () => void; onDraft: (value: string) => void; onSave: () => void; onCancel: () => void; onDelete: () => void };

export function WorkflowManageCard({ workflow, canEdit, editing, busy, draft, onOpen, onEdit, onDraft, onSave, onCancel, onDelete }: Props) {
  const nodeCount = Array.isArray(workflow.graph.nodes) ? workflow.graph.nodes.length : 0;
  return <article className="workflow-card workflow-card-reference workflow-manage-card">
    <button className="workflow-card-open" type="button" onClick={onOpen} title="باز کردن جریان"><WorkflowIcon /><div><b>{workflow.name}</b><span className="workflow-card-meta"><span>ایجاد: {formatDate(workflow.created_at)}</span><span>آخرین تغییر: {formatDate(workflow.updated_at)}</span><span>{nodeCount.toLocaleString('fa-IR')} نود</span></span></div></button>
    {canEdit && <div className={`workflow-name-editor ${editing ? 'is-editing' : 'is-viewing'}`}>
      {editing ? <>
        <Input autoFocus value={draft} maxLength={255} aria-label={`نام جریان ${workflow.name}`} onChange={(e) => onDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }} />
        <IconButton className="workflow-row-action" aria-label="ذخیره نام جریان" title="ذخیره نام جریان" loading={busy} icon={<Save size={15} />} onClick={onSave} />
        <IconButton className="workflow-row-action" aria-label="لغو ویرایش" title="لغو ویرایش" disabled={busy} icon={<X size={15} />} onClick={onCancel} />
      </> : <>
        <IconButton className="workflow-row-action" aria-label="ویرایش نام جریان" title="ویرایش نام جریان" disabled={busy} icon={<Pencil size={15} />} onClick={onEdit} />
        <IconButton className="workflow-row-action danger-action" variant="danger" aria-label="حذف جریان" title="حذف جریان" disabled={busy} icon={<Trash2 size={15} />} onClick={onDelete} />
      </>}
    </div>}
  </article>;
}
