import { useEffect, useState } from 'react';
import type { Dataset, Workflow } from '../../../../shared/types';
import { messageFromError, type UiMessage } from '../../../../shared/lib/errors';
import { workflowsApi } from '../../../../features/workflow/api/workflowsApi';
import { emptyWorkflowGraph, importWorkflowFile } from '../../../lib/workflowFiles';
import { invalidateProjectCaches } from '../../../lib/projectData';

type Params = { projectId: number; datasets: Dataset[]; workflows: Workflow[]; setWorkflows: (value: Workflow[] | ((current: Workflow[]) => Workflow[])) => void; refresh: () => Promise<unknown>; setMessage: (value: UiMessage) => void; onOpenEditor: (id: number | null) => void };

export function useWorkflowManagement({ projectId, datasets, workflows, setWorkflows, refresh, setMessage, onOpenEditor }: Params) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('جریان جدید');
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  useEffect(() => setDrafts((current) => Object.fromEntries(workflows.map((item) => [item.id, current[item.id] ?? item.name]))), [workflows]);
  const importFile = async (file: File) => {
    setImporting(true);
    try { const workflow = await importWorkflowFile(file, projectId, datasets[0]?.id ?? null, newName.trim() || 'جریان واردشده'); invalidateProjectCaches(projectId); await refresh(); setMessage({ text: 'Workflow JSON وارد شد', tone: 'success' }); onOpenEditor(workflow.id); }
    catch (error) { setMessage(messageFromError(error, 'Import Workflow ناموفق بود')); }
    finally { setImporting(false); }
  };
  const create = async () => {
    const name = newName.trim();
    if (!name) { setMessage({ text: 'نام جریان کاری را وارد کنید', tone: 'error' }); return; }
    setCreating(true);
    try {
      const workflow = await workflowsApi.create({ name, project_id: projectId, graph: emptyWorkflowGraph(datasets[0]?.id ?? null) });
      invalidateProjectCaches(projectId); await refresh(); setMessage({ text: 'جریان کاری ساخته شد', tone: 'success' }); onOpenEditor(workflow.id);
    } catch (error) { setMessage(messageFromError(error, 'ایجاد جریان کاری ناموفق بود')); }
    finally { setCreating(false); }
  };
  const saveName = async (workflow: Workflow) => {
    const name = (drafts[workflow.id] ?? workflow.name).trim();
    if (!name) { setMessage({ text: 'نام جریان نمی‌تواند خالی باشد', tone: 'error' }); return; }
    if (name === workflow.name) { setEditingId(null); return; }
    setActionId(workflow.id);
    try { const saved = await workflowsApi.rename(workflow.id, name); setWorkflows((items) => items.map((item) => item.id === saved.id ? saved : item)); setDrafts((items) => ({ ...items, [saved.id]: saved.name })); setEditingId(null); invalidateProjectCaches(projectId); setMessage({ text: 'نام جریان ذخیره شد', tone: 'success' }); }
    catch (error) { setMessage(messageFromError(error, 'ذخیره نام جریان ناموفق بود')); }
    finally { setActionId(null); }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    setActionId(deleteTarget.id);
    try { await workflowsApi.remove(deleteTarget.id); setWorkflows((items) => items.filter((item) => item.id !== deleteTarget.id)); setDrafts((items) => { const next = { ...items }; delete next[deleteTarget.id]; return next; }); invalidateProjectCaches(projectId); setDeleteTarget(null); setMessage({ text: 'جریان حذف شد', tone: 'success' }); }
    catch (error) { setMessage(messageFromError(error, 'حذف جریان ناموفق بود')); }
    finally { setActionId(null); }
  };
  const cancelEdit = (workflow: Workflow) => { setDrafts((items) => ({ ...items, [workflow.id]: workflow.name })); setEditingId(null); };
  return { drafts, setDrafts, editingId, setEditingId, actionId, importing, creating, newName, setNewName, deleteTarget, setDeleteTarget, create, importFile, saveName, remove, cancelEdit };
}
