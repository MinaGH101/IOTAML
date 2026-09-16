"""Validated workflow graph actions for the assistant domain."""

from __future__ import annotations

from copy import deepcopy
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from app.nodes.registry import canonical_node_id, get_node
from app.workflow.validation.service import compatible, validate_workflow_graph

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


WORKFLOW_ACTION_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "apply_workflow_actions",
        "description": (
            "Apply an atomic batch of validated edits to the selected workflow graph. "
            "Use only after inspecting the current workflow and resolving exact node "
            "instance IDs or creating nodes with client IDs for later references. "
            "The application validates node types, node IDs, ports, cycles, and draft "
            "graph structure before saving."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "operations": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 30,
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": {
                                "type": "string",
                                "enum": ["add_node", "update_node", "remove_node", "connect", "disconnect"],
                            },
                            "client_id": {
                                "type": ["string", "null"],
                                "description": "Temporary ID for a newly added node, so later operations in the same batch can reference it.",
                            },
                            "node_id": {
                                "type": ["string", "null"],
                                "description": "Existing node instance ID, or a temporary client_id from an earlier add_node operation.",
                            },
                            "registry_id": {
                                "type": ["string", "null"],
                                "description": "Catalog node ID for add_node, such as VZ-002 or MR-001.",
                            },
                            "label": {
                                "type": ["string", "null"],
                                "description": "Optional user-visible node label.",
                            },
                            "params": {
                                "type": ["object", "null"],
                                "description": "Node parameter values to merge into defaults or existing params.",
                                "additionalProperties": True,
                            },
                            "position": {
                                "type": ["object", "null"],
                                "properties": {
                                    "x": {"type": "number"},
                                    "y": {"type": "number"},
                                },
                                "required": ["x", "y"],
                                "additionalProperties": False,
                            },
                            "after_node_id": {
                                "type": ["string", "null"],
                                "description": "Optional existing node ID used to place a new node to the right of that node.",
                            },
                            "source_node_id": {
                                "type": ["string", "null"],
                                "description": "Source node instance ID or client_id for connect/disconnect.",
                            },
                            "target_node_id": {
                                "type": ["string", "null"],
                                "description": "Target node instance ID or client_id for connect/disconnect.",
                            },
                            "source_handle": {
                                "type": ["string", "null"],
                                "description": "Optional output port ID. Omit when the app should choose the first compatible port.",
                            },
                            "target_handle": {
                                "type": ["string", "null"],
                                "description": "Optional input port ID. Omit when the app should choose the first compatible port.",
                            },
                            "edge_id": {
                                "type": ["string", "null"],
                                "description": "Existing edge ID for disconnect.",
                            },
                        },
                        "required": [
                            "action",
                            "client_id",
                            "node_id",
                            "registry_id",
                            "label",
                            "params",
                            "position",
                            "after_node_id",
                            "source_node_id",
                            "target_node_id",
                            "source_handle",
                            "target_handle",
                            "edge_id",
                        ],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["operations"],
            "additionalProperties": False,
        },
        "strict": False,
    },
]


class WorkflowActionError(ValueError):
    """Raised when an assistant action cannot be applied safely."""


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _node_definition(registry_id: str) -> Any:
    canonical = canonical_node_id(registry_id)
    definition = get_node(canonical)
    if not definition:
        raise WorkflowActionError(f"Unknown node type: {registry_id}")
    if getattr(definition, "comingSoon", False) or not getattr(definition, "implemented", True):
        raise WorkflowActionError(f"Node type is not executable: {definition.name}")
    return definition


def _default_params(definition: Any) -> dict[str, Any]:
    return {setting.name: setting.default for setting in definition.settingsSchema}


def _node_label(definition: Any, index: int, explicit: Any) -> str:
    label = str(explicit or "").strip()
    return label or f"Node {index + 1}"


def _position(index: int, action: dict[str, Any], nodes_by_id: dict[str, dict[str, Any]]) -> dict[str, float]:
    raw_position = _as_dict(action.get("position"))
    x = raw_position.get("x")
    y = raw_position.get("y")
    if isinstance(x, (int, float)) and isinstance(y, (int, float)):
        return {"x": float(x), "y": float(y)}

    after_node_id = str(action.get("after_node_id") or "").strip()
    if after_node_id and after_node_id in nodes_by_id:
        source_position = _as_dict(nodes_by_id[after_node_id].get("position"))
        return {
            "x": float(source_position.get("x") or 0) + 260,
            "y": float(source_position.get("y") or 0),
        }

    return {
        "x": float(120 + (index % 4) * 260),
        "y": float(100 + (index // 4) * 180),
    }


def _make_node(definition: Any, index: int, action: dict[str, Any], nodes_by_id: dict[str, dict[str, Any]]) -> dict[str, Any]:
    registry_id = canonical_node_id(definition.id)
    node_id = str(action.get("node_id") or "").strip() or f"{registry_id}-{uuid4().hex[:10]}"
    if node_id in nodes_by_id:
        raise WorkflowActionError(f"Node ID already exists: {node_id}")

    params = _default_params(definition)
    params.update(_as_dict(action.get("params")))

    return {
        "id": node_id,
        "type": "mlNode",
        "position": _position(index, action, nodes_by_id),
        "data": {
            "registryId": registry_id,
            "catalogId": registry_id,
            "typeLabel": definition.name,
            "label": _node_label(definition, index, action.get("label")),
            "category": definition.category,
            "description": definition.description,
            "inputs": [port.__dict__ for port in definition.inputs],
            "outputs": [port.__dict__ for port in definition.outputs],
            "executionMode": definition.executionMode,
            "comingSoon": definition.comingSoon,
            "params": params,
        },
    }


def _resolve_node_id(value: Any, aliases: dict[str, str], nodes_by_id: dict[str, dict[str, Any]], field: str) -> str:
    raw = str(value or "").strip()
    node_id = aliases.get(raw, raw)
    if not node_id or node_id not in nodes_by_id:
        raise WorkflowActionError(f"Unknown {field}: {raw or '<empty>'}")
    return node_id


def _definition_for_instance(node: dict[str, Any]) -> Any:
    data = _as_dict(node.get("data"))
    registry_id = str(data.get("registryId") or data.get("catalogId") or node.get("type") or "").strip()
    return _node_definition(registry_id)


def _best_port_pair(
    source_node: dict[str, Any],
    target_node: dict[str, Any],
    source_handle: Any,
    target_handle: Any,
) -> tuple[str, str]:
    source_def = _definition_for_instance(source_node)
    target_def = _definition_for_instance(target_node)
    requested_source = str(source_handle or "").strip()
    requested_target = str(target_handle or "").strip()

    source_ports = [
        port for port in source_def.outputs
        if not requested_source or str(port.id) == requested_source
    ]
    target_ports = [
        port for port in target_def.inputs
        if not requested_target or str(port.id) == requested_target
    ]
    for source_port in source_ports:
        for target_port in target_ports:
            if compatible(str(source_port.type), str(target_port.type)):
                return str(source_port.id), str(target_port.id)

    raise WorkflowActionError(
        f"No compatible ports between {source_def.name} and {target_def.name}."
    )


def _add_edge(
    graph: dict[str, Any],
    *,
    source_node_id: str,
    target_node_id: str,
    source_handle: Any,
    target_handle: Any,
    nodes_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    source_port, target_port = _best_port_pair(
        nodes_by_id[source_node_id],
        nodes_by_id[target_node_id],
        source_handle,
        target_handle,
    )
    edge_id = f"e-{source_node_id}-{source_port}-{target_node_id}-{target_port}"
    edges = _as_list(graph.get("edges"))
    if any(str(edge.get("id") or "") == edge_id for edge in edges if isinstance(edge, dict)):
        raise WorkflowActionError(f"Connection already exists: {edge_id}")

    edge = {
        "id": edge_id,
        "source": source_node_id,
        "target": target_node_id,
        "sourceHandle": source_port,
        "targetHandle": target_port,
        "animated": True,
    }
    edges.append(edge)
    graph["edges"] = edges
    return edge


def apply_workflow_actions_to_graph(
    graph: dict[str, Any],
    operations: list[dict[str, Any]],
) -> dict[str, Any]:
    """Apply a batch of graph actions to a copy of ``graph``.

    The caller persists only after this function and draft validation both
    succeed, so the batch is atomic from the user's point of view.
    """
    next_graph = deepcopy(graph if isinstance(graph, dict) else {})
    next_graph.setdefault("nodes", [])
    next_graph.setdefault("edges", [])
    nodes = _as_list(next_graph.get("nodes"))
    edges = _as_list(next_graph.get("edges"))
    next_graph["nodes"] = nodes
    next_graph["edges"] = edges

    nodes_by_id = {
        str(node.get("id")): node
        for node in nodes
        if isinstance(node, dict) and node.get("id") is not None
    }
    aliases: dict[str, str] = {}
    applied: list[dict[str, Any]] = []

    for index, raw_operation in enumerate(operations):
        operation = _as_dict(raw_operation)
        action = str(operation.get("action") or "").strip()
        if not action:
            raise WorkflowActionError(f"Operation {index + 1} has no action.")

        if action == "add_node":
            definition = _node_definition(str(operation.get("registry_id") or ""))
            node = _make_node(definition, len(nodes), operation, nodes_by_id)
            nodes.append(node)
            nodes_by_id[str(node["id"])] = node
            client_id = str(operation.get("client_id") or "").strip()
            if client_id:
                aliases[client_id] = str(node["id"])
            applied.append({
                "action": action,
                "nodeId": node["id"],
                "nodeName": definition.name,
            })
            continue

        if action == "update_node":
            node_id = _resolve_node_id(operation.get("node_id"), aliases, nodes_by_id, "node_id")
            node = nodes_by_id[node_id]
            data = _as_dict(node.setdefault("data", {}))
            label = str(operation.get("label") or "").strip()
            if label:
                data["label"] = label
            params = _as_dict(operation.get("params"))
            if params:
                current_params = _as_dict(data.get("params"))
                data["params"] = {**current_params, **params}
            applied.append({"action": action, "nodeId": node_id})
            continue

        if action == "remove_node":
            node_id = _resolve_node_id(operation.get("node_id"), aliases, nodes_by_id, "node_id")
            next_graph["nodes"] = [
                node for node in _as_list(next_graph.get("nodes"))
                if not (isinstance(node, dict) and str(node.get("id") or "") == node_id)
            ]
            next_graph["edges"] = [
                edge for edge in _as_list(next_graph.get("edges"))
                if not (
                    isinstance(edge, dict)
                    and (str(edge.get("source") or "") == node_id or str(edge.get("target") or "") == node_id)
                )
            ]
            nodes = next_graph["nodes"]
            edges = next_graph["edges"]
            nodes_by_id.pop(node_id, None)
            applied.append({"action": action, "nodeId": node_id})
            continue

        if action == "connect":
            source_node_id = _resolve_node_id(operation.get("source_node_id"), aliases, nodes_by_id, "source_node_id")
            target_node_id = _resolve_node_id(operation.get("target_node_id"), aliases, nodes_by_id, "target_node_id")
            edge = _add_edge(
                next_graph,
                source_node_id=source_node_id,
                target_node_id=target_node_id,
                source_handle=operation.get("source_handle"),
                target_handle=operation.get("target_handle"),
                nodes_by_id=nodes_by_id,
            )
            applied.append({"action": action, "edgeId": edge["id"]})
            continue

        if action == "disconnect":
            edge_id = str(operation.get("edge_id") or "").strip()
            source_node_id = str(operation.get("source_node_id") or "").strip()
            target_node_id = str(operation.get("target_node_id") or "").strip()
            before = len(edges)
            next_graph["edges"] = [
                edge for edge in edges
                if not (
                    isinstance(edge, dict)
                    and (
                        (edge_id and str(edge.get("id") or "") == edge_id)
                        or (
                            source_node_id
                            and target_node_id
                            and str(edge.get("source") or "") == source_node_id
                            and str(edge.get("target") or "") == target_node_id
                        )
                    )
                )
            ]
            edges = next_graph["edges"]
            if len(edges) == before:
                raise WorkflowActionError("No matching connection was found to disconnect.")
            applied.append({"action": action, "removedEdges": before - len(edges)})
            continue

        raise WorkflowActionError(f"Unsupported workflow action: {action}")

    validation = validate_workflow_graph(
        next_graph,
        require_settings=False,
        require_connections=False,
    )
    if not validation.valid:
        first_error = (validation.errors or [None])[0]
        message = getattr(first_error, "message", None) or "Workflow validation failed."
        raise WorkflowActionError(str(message))

    next_graph["_assistantActionSummary"] = applied
    return next_graph


def apply_workflow_actions(
    *,
    db: "Session",
    workflow_id: int,
    owner_username: str,
    operations: list[dict[str, Any]],
) -> dict[str, Any]:
    from app.domains.workflows.schemas import WorkflowCreate
    from app.domains.workflows.service import get_workflow, update_workflow, validate_graph

    if not operations:
        return {
            "changed": False,
            "error": "At least one workflow action is required.",
        }

    workflow = get_workflow(db, workflow_id, owner_username)
    try:
        next_graph = apply_workflow_actions_to_graph(workflow.graph or {}, operations)
        applied = next_graph.pop("_assistantActionSummary", [])
        updated = update_workflow(
            db,
            workflow.id,
            WorkflowCreate(
                name=workflow.name,
                graph=next_graph,
                project_id=workflow.project_id,
                last_run_id=workflow.last_run_id,
            ),
            owner_username,
        )
    except WorkflowActionError as exc:
        return {
            "changed": False,
            "error": str(exc),
        }

    return {
        "changed": bool(applied),
        "workflowId": updated.id,
        "revision": updated.revision,
        "applied": applied,
        "draftValidation": validate_workflow_graph(
            updated.graph or {},
            require_settings=False,
            require_connections=False,
        ).model_dump(),
        "runValidation": validate_graph(updated.graph or {}),
    }
