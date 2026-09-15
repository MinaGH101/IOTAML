"""Assistant domain workflow tools for the IOTA ML backend."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session
from app.domains.workflows.service import get_workflow, validate_graph
from app.nodes.registry import canonical_node_id, get_node


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

        registry_id = str(
            data.get("registryId")
            or data.get("catalogId")
            or ""
        )
        definition = get_node(canonical_node_id(registry_id)) if registry_id else None
        input_types = [port.type for port in definition.inputs] if definition else []
        output_types = [port.type for port in definition.outputs] if definition else []
        category = str(data.get("category") or (definition.category if definition else ""))
        type_label = str(data.get("typeLabel") or (definition.name if definition else ""))

        nodes.append(
            {
                "instanceId": str(node.get("id") or ""),
                "registryId": registry_id,
                "inputTypes": input_types,
                "outputTypes": output_types,
                "typeLabel": type_label,
                "label": str(data.get("label") or ""),
                "category": category,
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

    incoming = {node["instanceId"]: [] for node in nodes}
    outgoing = {node["instanceId"]: [] for node in nodes}

    for edge in edges:
        source = edge["source"]
        target = edge["target"]
        if source in outgoing:
            outgoing[source].append(target)
        if target in incoming:
            incoming[target].append(source)

    for node in nodes:
        node["incomingNodeIds"] = incoming.get(node["instanceId"], [])
        node["outgoingNodeIds"] = outgoing.get(node["instanceId"], [])

    visualization_nodes = [
        node for node in nodes
        if node["category"] == "Visualizations" or "plot" in node["outputTypes"]
    ]

    dataframe_nodes = [
        node for node in nodes
        if "dataframe" in node["outputTypes"]
    ]

    dataframe_endpoints = [
        node for node in dataframe_nodes
        if not outgoing.get(node["instanceId"])
    ]

    def attachment_rank(node: dict[str, Any]) -> int:
        category = node["category"]
        name = f"{node['label']} {node['typeLabel']}".casefold()
        score = 0
        if category in {"Data Cleaning", "Transformation", "ML Data Processing"}:
            score += 30
        if any(term in name for term in ["detection", "imputation", "replace", "select", "filter", "normalize", "scaler"]):
            score += 20
        score += len(node.get("incomingNodeIds") or [])
        return score

    preferred_dataframe_sources = sorted(
        dataframe_nodes,
        key=attachment_rank,
        reverse=True,
    )[:5]

    workflow_summary = {
        "visualizationNodeIds": [node["instanceId"] for node in visualization_nodes],
        "visualizationNodeNames": [node["label"] or node["typeLabel"] for node in visualization_nodes],
        "dataframeNodeIds": [node["instanceId"] for node in dataframe_nodes],
        "dataframeEndpointNodeIds": [node["instanceId"] for node in dataframe_endpoints],
        "preferredDataframeSourceNodeIds": [node["instanceId"] for node in preferred_dataframe_sources],
        "dataQualityNodeIds": [
            node["instanceId"] for node in nodes
            if node["category"] in {"Data Cleaning", "Data Inspection"}
        ],
        "mlNodeIds": [
            node["instanceId"] for node in nodes
            if node["category"].startswith("ML ")
        ],
    }

    metadata = graph.get("meta") or {}

    return {
        "workflowId": workflow.id,
        "name": workflow.name,
        "revision": workflow.revision,
        "nodeCount": len(nodes),
        "edgeCount": len(edges),
        "nodes": nodes,
        "edges": edges,
        "summary": workflow_summary,
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