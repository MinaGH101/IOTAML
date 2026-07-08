from __future__ import annotations

def affected_downstream_nodes(changed_node_id: str, edges: list[dict]) -> set[str]:
    outgoing: dict[str, list[str]] = {}
    for edge in edges:
        outgoing.setdefault(str(edge.get('source')), []).append(str(edge.get('target')))
    affected: set[str] = set()
    stack = [changed_node_id]
    while stack:
        current = stack.pop()
        for target in outgoing.get(current, []):
            if target not in affected:
                affected.add(target)
                stack.append(target)
    return affected
