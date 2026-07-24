import type { Edge, Node } from '@xyflow/react';

export type WorkflowLayoutViewport = {
  width: number;
  height: number;
  paletteCollapsed: boolean;
  resultsCollapsed: boolean;
  resultsWidth: number;
};

export function layoutWorkflowNodes(
  nodes: Node[],
  edges: Edge[],
  viewport: WorkflowLayoutViewport,
) {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  nodes.forEach((node) => {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  });
  edges.forEach((edge) => {
    outgoing.get(edge.source)?.push(edge.target);
    incoming.get(edge.target)?.push(edge.source);
  });

  const roots = nodes
    .filter((node) => (incoming.get(node.id) || []).length === 0)
    .map((node) => node.id);
  const depth = new Map<string, number>();
  const queue = roots.length ? [...roots] : nodes.slice(0, 1).map((node) => node.id);
  queue.forEach((id) => depth.set(id, 0));
  while (queue.length) {
    const id = queue.shift()!;
    const nextDepth = (depth.get(id) || 0) + 1;
    (outgoing.get(id) || []).forEach((child) => {
      if (!depth.has(child) || nextDepth > (depth.get(child) || 0)) {
        depth.set(child, nextDepth);
        queue.push(child);
      }
    });
  }
  nodes.forEach((node) => {
    if (!depth.has(node.id)) depth.set(node.id, 0);
  });

  const groups = new Map<number, Node[]>();
  nodes.forEach((node) => {
    const nodeDepth = depth.get(node.id) || 0;
    groups.set(nodeDepth, [...(groups.get(nodeDepth) || []), node]);
  });

  const panelGap = 16;
  const panelTopOffset = 76;
  const leftInset = panelGap + (viewport.paletteCollapsed ? 56 : 272) + 36;
  const rightInset = panelGap + (viewport.resultsCollapsed ? 56 : viewport.resultsWidth) + 36;
  const topInset = panelTopOffset + 34;
  const bottomInset = panelGap + 34;
  const availableWidth = Math.max(540, viewport.width - leftInset - rightInset);
  const availableHeight = Math.max(420, viewport.height - topInset - bottomInset);
  const columnCount = Math.max(groups.size, 1);
  const columnGap = columnCount > 1
    ? Math.min(280, Math.max(210, availableWidth / Math.max(columnCount - 1, 1)))
    : 0;
  const rowGap = Math.min(170, Math.max(138, availableHeight / Math.max(nodes.length, 3)));

  return nodes.map((node) => {
    const nodeDepth = depth.get(node.id) || 0;
    const group = groups.get(nodeDepth) || [];
    const index = group.findIndex((item) => item.id === node.id);
    const stackHeight = Math.max(0, (group.length - 1) * rowGap);
    const startY = topInset + Math.max(0, (availableHeight - stackHeight) / 2);
    return {
      ...node,
      position: {
        x: leftInset + nodeDepth * columnGap,
        y: startY + index * rowGap,
      },
    };
  });
}
