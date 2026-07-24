import type { Edge, Node } from '@xyflow/react';
import type { ComponentBoundaryPort } from '../../shared/_types';

export type ComponentBoundary = {
  selected: Set<string>;
  selectedNodes: Node[];
  internalEdges: Edge[];
  incoming: Edge[];
  outgoing: Edge[];
  inputs: ComponentBoundaryPort[];
  outputs: ComponentBoundaryPort[];
  disconnected: boolean;
};

function nodePortType(
  nodes: Node[],
  nodeId: string,
  handle: string | null | undefined,
  side: 'inputs' | 'outputs',
) {
  const node = nodes.find((item) => item.id === nodeId);
  const ports = (node?.data?.[side] || []) as Array<{
    id: string;
    type?: string;
    name?: string;
  }>;
  return ports.find(
    (port) => port.id === String(handle || (side === 'inputs' ? 'input' : 'output')),
  )?.type || ports[0]?.type || 'any';
}

export function analyzeComponentBoundary(
  nodes: Node[],
  edges: Edge[],
  selectedIds: string[],
): ComponentBoundary | null {
  const selected = new Set(selectedIds);
  const selectedNodes = nodes.filter((node) => selected.has(node.id));
  if (selectedNodes.length < 2) return null;

  const internalEdges = edges.filter(
    (edge) => selected.has(edge.source) && selected.has(edge.target),
  );
  const adjacency = new Map(
    selectedNodes.map((node) => [node.id, new Set<string>()]),
  );
  internalEdges.forEach((edge) => {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });
  const visited = new Set<string>();
  const queue = [selectedNodes[0].id];
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    adjacency.get(current)?.forEach((next) => {
      if (!visited.has(next)) queue.push(next);
    });
  }

  const incoming = edges.filter(
    (edge) => selected.has(edge.target) && !selected.has(edge.source),
  );
  const outgoing = edges.filter(
    (edge) => selected.has(edge.source) && !selected.has(edge.target),
  );
  const inputs: ComponentBoundaryPort[] = incoming.map((edge, index) => ({
    id: `input_${index + 1}`,
    name: String(edge.targetHandle || `Input ${index + 1}`),
    type: nodePortType(nodes, edge.target, edge.targetHandle, 'inputs'),
    required: true,
    multiple: false,
    internal_node_id: edge.target,
    internal_handle: String(edge.targetHandle || 'input'),
  }));
  const outputs: ComponentBoundaryPort[] = outgoing.map((edge, index) => ({
    id: `output_${index + 1}`,
    name: String(edge.sourceHandle || `Output ${index + 1}`),
    type: nodePortType(nodes, edge.source, edge.sourceHandle, 'outputs'),
    required: true,
    multiple: false,
    internal_node_id: edge.source,
    internal_handle: String(edge.sourceHandle || 'output'),
  }));

  return {
    selected,
    selectedNodes,
    internalEdges,
    incoming,
    outgoing,
    inputs,
    outputs,
    disconnected: visited.size !== selectedNodes.length,
  };
}
