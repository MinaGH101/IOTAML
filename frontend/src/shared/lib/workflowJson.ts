import type { Edge, Node } from '@xyflow/react';

export type PortableWorkflow = {
  format: 'iota-workflow';
  version: 1;
  app: 'IOTA ML';
  exportedAt: string;
  name: string;
  graph: {
    nodes: Node[];
    edges: Edge[];
    meta?: Record<string, unknown>;
  };
};

function cleanFilename(value: string) {
  return (value || 'workflow').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'workflow';
}

export function exportWorkflowJson(name: string, graph: PortableWorkflow['graph']) {
  const payload: PortableWorkflow = {
    format: 'iota-workflow',
    version: 1,
    app: 'IOTA ML',
    exportedAt: new Date().toISOString(),
    name: name.trim() || 'Untitled Workflow',
    graph
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${cleanFilename(payload.name)}.workflow.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function readWorkflowJson(file: File): Promise<{ name: string; graph: PortableWorkflow['graph'] }> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Workflow JSON is too large. Maximum size is 10 MB.');
  const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
  const graphCandidate = parsed.format === 'iota-workflow' ? parsed.graph : parsed.graph ?? parsed;
  if (!graphCandidate || typeof graphCandidate !== 'object' || Array.isArray(graphCandidate)) throw new Error('Invalid workflow JSON: graph object is missing.');
  const graph = graphCandidate as Record<string, unknown>;
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error('Invalid workflow JSON: nodes and edges must be arrays.');
  return {
    name: String(parsed.name || file.name.replace(/\.workflow\.json$|\.json$/i, '') || 'Imported Workflow'),
    graph: { nodes: graph.nodes as Node[], edges: graph.edges as Edge[], meta: (graph.meta && typeof graph.meta === 'object' && !Array.isArray(graph.meta)) ? graph.meta as Record<string, unknown> : {} }
  };
}
