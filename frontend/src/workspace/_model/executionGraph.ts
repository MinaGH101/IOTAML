import type { Edge, Node } from '@xyflow/react';
export function connectedGraph(allNodes: Node[], allEdges: Edge[], selectedNodeId: string | null) {
    if (selectedNodeId && !allNodes.some((node) => node.id === selectedNodeId)) return { nodes: [], edges: [], mode: 'selected' as const };
    if (!selectedNodeId) {
        return { nodes: allNodes, edges: allEdges, mode: 'all' as const };
    }
    const upstream = new Map<string, Set<string>>();
    allNodes.forEach((node) => upstream.set(node.id, new Set()));
    allEdges.forEach((edge) => {
        upstream.get(edge.target)?.add(edge.source);
    });
    const keep = new Set<string>();
    const queue = [selectedNodeId];
    while (queue.length) {
        const current = queue.pop()!;
        if (keep.has(current))
            continue;
        keep.add(current);
        upstream.get(current)?.forEach((parent) => {
            if (!keep.has(parent))
                queue.push(parent);
        });
    }
    return {
        nodes: allNodes.filter((node) => keep.has(node.id)),
        edges: allEdges.filter((edge) => keep.has(edge.source) && keep.has(edge.target)),
        mode: 'selected' as const,
    };
}
