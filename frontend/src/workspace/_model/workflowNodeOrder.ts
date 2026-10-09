import type { Edge, Node } from '@xyflow/react';

/** Stable graph order for UI traversal, independent of persisted array order. */
export function workflowNodeOrder(nodes: Node[], edges: Edge[]): Node[] {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const originalIndex = new Map(nodes.map((node, index) => [node.id, index]));
    const indegree = new Map(nodes.map((node) => [node.id, 0]));
    const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
    for (const edge of edges) {
        if (!byId.has(edge.source) || !byId.has(edge.target) || edge.source === edge.target)
            continue;
        outgoing.get(edge.source)?.push(edge.target);
        indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
    }
    const sortIds = (ids: string[]) => ids.sort((a, b) => (originalIndex.get(a) || 0) - (originalIndex.get(b) || 0));
    const ready = sortIds(nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id));
    const ordered: Node[] = [];
    const visited = new Set<string>();
    while (ready.length) {
        const id = ready.shift()!;
        if (visited.has(id))
            continue;
        visited.add(id);
        ordered.push(byId.get(id)!);
        for (const target of outgoing.get(id) || []) {
            indegree.set(target, (indegree.get(target) || 0) - 1);
            if (indegree.get(target) === 0)
                ready.push(target);
        }
        sortIds(ready);
    }
    ordered.push(...nodes.filter((node) => !visited.has(node.id)));
    return ordered;
}
