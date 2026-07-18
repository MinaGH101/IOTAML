from __future__ import annotations

from collections import defaultdict, deque
from typing import Any


def node_registry_id(node: dict[str, Any]) -> str:
    data = node.get('data') or {}
    return str(data.get('registryId') or node.get('type') or '')


def topological_sort(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[str]:
    ids = [str(n['id']) for n in nodes]
    outgoing: dict[str, list[str]] = defaultdict(list)
    incoming = {node_id: 0 for node_id in ids}
    for edge in edges:
        source, target = str(edge.get('source')), str(edge.get('target'))
        if source in incoming and target in incoming:
            outgoing[source].append(target)
            incoming[target] += 1
    queue = deque([node_id for node_id, count in incoming.items() if count == 0])
    order: list[str] = []
    while queue:
        current = queue.popleft()
        order.append(current)
        for target in outgoing.get(current, []):
            incoming[target] -= 1
            if incoming[target] == 0:
                queue.append(target)
    if len(order) != len(ids):
        raise ValueError('Workflow contains a circular dependency.')
    return order


def output_for_handle(value: Any, source_handle: str | None) -> Any:
    handle = str(source_handle or 'output')
    if isinstance(value, dict):
        by_port = value.get('outputs_by_port')
        if isinstance(by_port, dict) and handle in by_port:
            return by_port[handle]
        if handle in value and handle not in {'output', 'outputs'}:
            return value[handle]
    return value


def upstream_outputs(node_id: str, edges: list[dict[str, Any]], outputs: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {'_by_port': {}, '_edges': []}
    by_port: dict[str, list[Any]] = result['_by_port']
    for edge in edges:
        if str(edge.get('target')) != node_id:
            continue
        source = str(edge.get('source'))
        if source not in outputs:
            continue
        source_handle = str(edge.get('sourceHandle') or 'output')
        value = output_for_handle(outputs[source], source_handle)
        result[source] = value
        target_handle = str(edge.get('targetHandle') or 'input')
        by_port.setdefault(target_handle, []).append(value)
        result['_edges'].append({'source': source, 'sourceHandle': source_handle, 'targetHandle': target_handle})
    return result
