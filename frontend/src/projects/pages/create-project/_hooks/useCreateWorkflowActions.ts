import { useState } from 'react';
import type { Dataset, Project, Workflow } from '../../../../shared/types';
import { messageFromError, type UiMessage } from '../../../../shared/lib/errors';
import { workflowsApi } from '../../../../features/workflow/api/workflowsApi';
import { emptyWorkflowGraph, importWorkflowFile } from '../../../lib/workflowFiles';
import { invalidateProjectCaches } from '../../../lib/projectData';

type Params = {
  project: Project | null; datasets: Dataset[]; workflowName: string;
  ensureProject: () => Promise<Project | null>; refresh: (projectId: number) => Promise<void>;
  setMessage: (value: UiMessage) => void; onOpenEditor: (project: Project, workflowId: number | null) => void;
};

export function useCreateWorkflowActions({ project, datasets, workflowName, ensureProject, refresh, setMessage, onOpenEditor }: Params) {
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const create = async () => {
    const name = workflowName.trim();
    if (!name) { setMessage({ text: 'نام جریان کاری را وارد کنید', tone: 'error' }); return; }
    setCreating(true); setMessage({ text: project ? 'در حال ساخت جریان کاری...' : 'در حال ساخت پروژه و جریان کاری...', tone: 'info' });
    try {
      const active = await ensureProject(); if (!active) return;
      const workflow = await workflowsApi.create({ name, project_id: active.id, graph: emptyWorkflowGraph(datasets[0]?.id ?? null) });
      invalidateProjectCaches(active.id); await refresh(active.id); setMessage({ text: 'جریان کاری ساخته شد', tone: 'success' }); onOpenEditor(active, workflow.id);
    } catch (error) { setMessage(messageFromError(error, 'ایجاد جریان کاری ناموفق بود')); }
    finally { setCreating(false); }
  };
  const importFile = async (file: File) => {
    setImporting(true); setMessage({ text: 'در حال بررسی و وارد کردن Workflow JSON...', tone: 'info' });
    try {
      const active = await ensureProject(); if (!active) return;
      const workflow = await importWorkflowFile(file, active.id, datasets[0]?.id ?? null, workflowName.trim() || 'Imported Workflow');
      invalidateProjectCaches(active.id); await refresh(active.id); setMessage({ text: 'Workflow JSON وارد شد', tone: 'success' }); onOpenEditor(active, workflow.id);
    } catch (error) { setMessage(messageFromError(error, 'Import Workflow ناموفق بود')); }
    finally { setImporting(false); }
  };
  return { creating, importing, create, importFile };
}
