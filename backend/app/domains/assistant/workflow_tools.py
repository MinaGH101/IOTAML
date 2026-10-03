"""Assistant domain workflow tools for the IOTA ML backend."""

from __future__ import annotations

from collections import deque
from typing import Any

from sqlalchemy.orm import Session

from app.domains.datasets.repository import dataset_repository
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


def _ports_for_context(node: dict[str, Any], definition: Any, side: str) -> list[dict[str, Any]]:
    declared = getattr(definition, side, None) if definition else None
    if declared is not None:
        return [
            {
                "id": str(port.id),
                "name": str(port.name or port.id),
                "type": str(port.type),
                "required": bool(port.required),
                "multiple": bool(port.multiple),
            }
            for port in declared
        ]

    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    stored = data.get(side) if isinstance(data.get(side), list) else []
    return [
        {
            "id": str(port.get("id") or ""),
            "name": str(port.get("name") or port.get("id") or ""),
            "type": str(port.get("type") or "any"),
            "required": bool(port.get("required", side == "inputs")),
            "multiple": bool(port.get("multiple", False)),
        }
        for port in stored
        if isinstance(port, dict) and port.get("id")
    ]


def get_workflow_context(
    db: Session,
    workflow_id: int,
    owner_username: str,
) -> dict[str, Any]:
    workflow = get_workflow(db, workflow_id, owner_username)
    graph = workflow.graph if isinstance(workflow.graph, dict) else {}

    nodes = []
    for ordinal, node in enumerate(graph.get("nodes") or [], start=1):
        data = node.get("data") or {}

        registry_id = str(
            data.get("registryId")
            or data.get("catalogId")
            or ""
        )
        definition = get_node(canonical_node_id(registry_id)) if registry_id else None
        inputs = _ports_for_context(node, definition, "inputs")
        outputs = _ports_for_context(node, definition, "outputs")
        input_types = [port["type"] for port in inputs]
        output_types = [port["type"] for port in outputs]
        category = str(data.get("category") or (definition.category if definition else ""))
        type_label = str(data.get("typeLabel") or (definition.name if definition else ""))

        nodes.append(
            {
                "instanceId": str(node.get("id") or ""),
                "nodeRef": f"Node {ordinal}",
                "ordinal": ordinal,
                "registryId": registry_id,
                "inputTypes": input_types,
                "outputTypes": output_types,
                "inputs": inputs,
                "outputs": outputs,
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

    # Depth gives the assistant a deterministic notion of "latest" that follows
    # the graph instead of relying on canvas order. Cycles are left at their
    # last safely computed depth; the validator reports the cycle separately.
    indegree = {node_id: len(source_ids) for node_id, source_ids in incoming.items()}
    graph_depth = {node_id: 0 for node_id in incoming}
    queue = deque(node_id for node_id, degree in indegree.items() if degree == 0)
    while queue:
        source_id = queue.popleft()
        for target_id in outgoing.get(source_id, []):
            graph_depth[target_id] = max(
                graph_depth.get(target_id, 0),
                graph_depth.get(source_id, 0) + 1,
            )
            indegree[target_id] = max(0, indegree.get(target_id, 0) - 1)
            if indegree[target_id] == 0:
                queue.append(target_id)

    for node in nodes:
        node["graphDepth"] = graph_depth.get(node["instanceId"], 0)

    visualization_nodes = [
        node for node in nodes
        if node["category"] == "Visualizations" or "plot" in node["outputTypes"]
    ]

    dataframe_nodes = [
        node for node in nodes
        if "dataframe" in node["outputTypes"]
    ]

    dataframe_node_ids = {node["instanceId"] for node in dataframe_nodes}
    for node in dataframe_nodes:
        node["downstreamDataframeNodeIds"] = [
            target_id
            for target_id in outgoing.get(node["instanceId"], [])
            if target_id in dataframe_node_ids
        ]

    dataframe_endpoints = [
        node for node in dataframe_nodes
        if not node["downstreamDataframeNodeIds"]
    ]

    modeling_source_categories = {
        "Data Input",
        "Data Cleaning",
        "Transformation",
        "ML Data Processing",
        "Utilities",
    }
    modeling_source_nodes = [
        node for node in dataframe_nodes
        if node["category"] in modeling_source_categories
    ] or dataframe_nodes
    modeling_source_ids = {node["instanceId"] for node in modeling_source_nodes}
    for node in modeling_source_nodes:
        node["downstreamModelingNodeIds"] = [
            target_id
            for target_id in outgoing.get(node["instanceId"], [])
            if target_id in modeling_source_ids
        ]
    modeling_endpoints = [
        node for node in modeling_source_nodes
        if not node["downstreamModelingNodeIds"]
    ]

    def attachment_rank(node: dict[str, Any]) -> int:
        category = node["category"]
        name = f"{node['label']} {node['typeLabel']}".casefold()
        score = int(node.get("graphDepth") or 0) * 10
        if not node.get("downstreamModelingNodeIds"):
            score += 100
        if category in {"Data Cleaning", "Transformation", "ML Data Processing"}:
            score += 40
        if any(term in name for term in ["detection", "imputation", "replace", "select", "filter", "normalize", "scaler"]):
            score += 25
        # A branch fan-in is usually a more complete modeling table than one
        # of its individual inputs.
        score += len(node.get("incomingNodeIds") or []) * 2
        return score

    preferred_dataframe_sources = sorted(
        modeling_source_nodes,
        key=attachment_rank,
        reverse=True,
    )[:5]

    workflow_summary = {
        "visualizationNodeIds": [node["instanceId"] for node in visualization_nodes],
        "visualizationNodeNames": [node["label"] or node["typeLabel"] for node in visualization_nodes],
        "dataframeNodeIds": [node["instanceId"] for node in dataframe_nodes],
        "dataframeEndpointNodeIds": [node["instanceId"] for node in dataframe_endpoints],
        "modelingDataframeEndpointNodeIds": [node["instanceId"] for node in modeling_endpoints],
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
    dataset_id = metadata.get("datasetId")
    if not dataset_id:
        for node in nodes:
            params = node.get("params") if isinstance(node.get("params"), dict) else {}
            candidate = params.get("dataset_id")
            if candidate:
                dataset_id = candidate
                break

    dataset_profile = None
    try:
        dataset_id_int = int(dataset_id) if dataset_id is not None else 0
    except (TypeError, ValueError):
        dataset_id_int = 0
    if dataset_id_int:
        dataset = dataset_repository.get(db, dataset_id_int, owner_username)
        if dataset is not None:
            columns = [
                column for column in (dataset.columns if isinstance(dataset.columns, list) else [])
                if isinstance(column, dict)
            ]
            numeric_markers = ("int", "float", "double", "decimal", "number")
            numeric_count = sum(
                1 for column in columns
                if any(marker in str(column.get("dtype") or "").casefold() for marker in numeric_markers)
            )
            dataset_profile = {
                "datasetId": dataset.id,
                "name": dataset.name,
                "rowCount": dataset.row_count,
                "columnCount": len(columns),
                "numericColumnCount": numeric_count,
                "nonNumericColumnCount": max(0, len(columns) - numeric_count),
                "columnsWithMissingValues": [
                    str(column.get("name") or "")
                    for column in columns
                    if int(column.get("missing") or 0) > 0
                ][:30],
            }

    return {
        "workflowId": workflow.id,
        "name": workflow.name,
        "revision": workflow.revision,
        "nodeCount": len(nodes),
        "edgeCount": len(edges),
        "nodes": nodes,
        "edges": edges,
        "summary": workflow_summary,
        "datasetProfile": dataset_profile,
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
