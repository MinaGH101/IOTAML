from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.domains.workflows.service import get_workflow, validate_graph


def _compact(value: Any, depth: int = 0) -> Any:
    if depth >= 4:
        return "[truncated]"

    if isinstance(value, str):
        return value[:500]

    if isinstance(value, list):
        return [_compact(item, depth + 1) for item in value[:30]]

    if isinstance(value, dict):
        return {
            str(key): _compact(item, depth + 1)
            for key, item in list(value.items())[:50]
        }

    return value


def get_workflow_context(
    db: Session,
    workflow_id: int,
    owner_username: str,
) -> dict[str, Any]:
    workflow = get_workflow(db, workflow_id, owner_username)
    graph = workflow.graph if isinstance(workflow.graph, dict) else {}

    nodes = []
    for node in graph.get("nodes") or []:
        data = node.get("data") or {}

        nodes.append(
            {
                "instanceId": str(node.get("id") or ""),
                "registryId": str(
                    data.get("registryId")
                    or data.get("catalogId")
                    or ""
                ),
                "typeLabel": str(data.get("typeLabel") or ""),
                "label": str(data.get("label") or ""),
                "category": str(data.get("category") or ""),
                "description": str(data.get("description") or "")[:240],
                "params": _compact(data.get("params") or {}),
            }
        )

    edges = [
        {
            "id": str(edge.get("id") or ""),
            "source": str(edge.get("source") or ""),
            "target": str(edge.get("target") or ""),
            "sourceHandle": edge.get("sourceHandle"),
            "targetHandle": edge.get("targetHandle"),
        }
        for edge in (graph.get("edges") or [])
    ]

    metadata = graph.get("meta") or {}

    return {
        "workflowId": workflow.id,
        "name": workflow.name,
        "revision": workflow.revision,
        "nodeCount": len(nodes),
        "edgeCount": len(edges),
        "nodes": nodes,
        "edges": edges,
        "metadata": {
            "datasetId": metadata.get("datasetId"),
            "targetColumn": metadata.get("targetColumn"),
            "taskType": metadata.get("taskType"),
        },
    }


def validate_workflow_context(
    db: Session,
    workflow_id: int,
    owner_username: str,
) -> dict[str, Any]:
    workflow = get_workflow(db, workflow_id, owner_username)
    graph = workflow.graph if isinstance(workflow.graph, dict) else {}

    result = validate_graph(graph)

    return {
        "workflowId": workflow.id,
        "revision": workflow.revision,
        "valid": bool(result.get("valid")),
        "errors": result.get("errors") or [],
        "warnings": result.get("warnings") or [],
    }