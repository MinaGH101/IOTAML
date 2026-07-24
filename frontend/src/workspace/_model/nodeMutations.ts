import type { Node } from '@xyflow/react';

export type PinnedNodeData = {
  enabled?: boolean;
  sample?: string;
};

function updateNodeData(
  nodes: Node[],
  nodeId: string,
  patch: Record<string, unknown>,
) {
  return nodes.map((node) => (
    node.id === nodeId
      ? { ...node, data: { ...node.data, ...patch } }
      : node
  ));
}

export function updateNodeParameters(
  nodes: Node[],
  nodeId: string,
  params: Record<string, unknown>,
) {
  return updateNodeData(nodes, nodeId, { params });
}

export function renameWorkflowNode(nodes: Node[], nodeId: string, label: string) {
  return updateNodeData(nodes, nodeId, { label });
}

export function updateNodePinnedOutput(
  nodes: Node[],
  nodeId: string,
  pinned: PinnedNodeData,
) {
  return updateNodeData(nodes, nodeId, { pinned });
}
