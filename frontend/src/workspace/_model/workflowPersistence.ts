import type { Edge, Node } from '@xyflow/react';

export function createAutosaveSnapshot({
  name,
  graph,
  projectId,
  lastRunId,
}: {
  name: string;
  graph: Record<string, unknown>;
  projectId: number;
  lastRunId: number | null;
}) {
  return {
    name: name.trim(),
    graph,
    project_id: projectId,
    last_run_id: lastRunId,
  };
}

export function createAutosaveSignature({
  name,
  projectId,
  lastRunId,
  nodes,
  edges,
  datasetId,
  targetColumn,
  taskType,
  activeBoardId,
  analysisBoards,
}: {
  name: string;
  projectId: number;
  lastRunId: number | null;
  nodes: Node[];
  edges: Edge[];
  datasetId: number | null;
  targetColumn: string;
  taskType: string;
  activeBoardId: string;
  analysisBoards: unknown;
}) {
  return JSON.stringify({
    name: name.trim(),
    projectId,
    workflowLastRunId: lastRunId,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      data: edge.data,
    })),
    datasetId,
    targetColumn,
    taskType,
    activeBoardId,
    analysisBoards,
  });
}
