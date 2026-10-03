import type { Workflow } from '../../shared/types';
import { readWorkflowJson } from '../../shared/lib/workflowJson';
import { workflowsApi } from '../../features/workflow/api/workflowsApi';

export function emptyWorkflowGraph(datasetId: number | null): Record<string, unknown> {
  return { nodes: [], edges: [], meta: { datasetId, targetColumn: 'target', taskType: 'auto' } };
}

export async function importWorkflowFile(file: File, projectId: number, datasetId: number | null, fallbackName = 'Imported Workflow'): Promise<Workflow> {
  const imported = await readWorkflowJson(file);
  const meta = imported.graph.meta as Record<string, unknown> | undefined;
  const graph = { ...imported.graph, meta: { ...(meta || {}), datasetId: meta?.datasetId ?? datasetId } } as Record<string, unknown>;
  const validation = await workflowsApi.validate(graph);
  if (!validation.valid) throw new Error('فایل جریان کاری قابل استفاده نیست. اتصال‌ها و تنظیمات نودها را بررسی کنید.');
  return workflowsApi.create({ name: imported.name || fallbackName, project_id: projectId, graph });
}
