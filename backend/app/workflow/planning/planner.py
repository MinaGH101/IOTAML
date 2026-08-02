"""Deterministic execution planning and selected-node dependency closure."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.workflow.graph.operations import topological_sort


@dataclass(frozen=True)
class ExecutionPlan:
    graph: dict[str, Any]
    order: tuple[str, ...]
    selected_node_id: str | None


def _upstream_closure(selected_node_id: str, edges: list[dict[str, Any]]) -> set[str]:
    incoming: dict[str, list[str]] = {}
    for edge in edges:
        source = str(edge.get('source') or '')
        target = str(edge.get('target') or '')
        if source and target:
            incoming.setdefault(target, []).append(source)
    closure = {selected_node_id}
    stack = [selected_node_id]
    while stack:
        current = stack.pop()
        for parent in incoming.get(current, []):
            if parent not in closure:
                closure.add(parent)
                stack.append(parent)
    return closure


def build_execution_plan(graph: dict[str, Any], selected_node_id: str | None = None) -> ExecutionPlan:
    nodes = [node for node in (graph.get('nodes') or []) if isinstance(node, dict)]
    edges = [edge for edge in (graph.get('edges') or []) if isinstance(edge, dict)]
    node_ids = {str(node.get('id')) for node in nodes if node.get('id') is not None}
    selected = str(selected_node_id).strip() if selected_node_id not in [None, ''] else None
    if selected and selected not in node_ids:
        raise ValueError(f'Selected node does not exist: {selected}')

    included = _upstream_closure(selected, edges) if selected else node_ids
    planned_nodes = [node for node in nodes if str(node.get('id')) in included]
    planned_edges = [
        edge for edge in edges
        if str(edge.get('source')) in included and str(edge.get('target')) in included
    ]
    planned_graph = {
        **graph,
        'nodes': planned_nodes,
        'edges': planned_edges,
        'meta': {
            **(graph.get('meta') if isinstance(graph.get('meta'), dict) else {}),
            'selectedNodeId': selected,
            'plannedNodeCount': len(planned_nodes),
        },
    }
    order = tuple(topological_sort(planned_nodes, planned_edges))
    return ExecutionPlan(graph=planned_graph, order=order, selected_node_id=selected)
