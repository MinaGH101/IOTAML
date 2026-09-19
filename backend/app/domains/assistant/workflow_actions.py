"""Validated workflow graph actions for the assistant domain."""

from __future__ import annotations

from copy import deepcopy
import re
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
            "Use only after inspecting the current workflow. Use insert_node to place a "
            "node after an existing node: it connects the new node and safely replaces a "
            "single downstream connection when one exists. The application validates node "
            "references, port IDs, cycles, and draft graph structure before saving."
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
                                "enum": ["add_node", "insert_node", "update_node", "remove_node", "connect", "disconnect"],
                            },
                            "client_id": {
                                "type": ["string", "null"],
                                "description": "Temporary ID for a newly added node, so later operations in the same batch can reference it.",
                            },
                            "node_id": {
                                "type": ["string", "null"],
                                "description": "Existing node instance ID, its Node N reference returned by get_current_workflow, or a temporary client_id from an earlier add/insert operation.",
                            },
                            "registry_id": {
                                "type": ["string", "null"],
                                "description": "Catalog node ID for add_node or insert_node, such as VZ-002 or CL-010.",
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
                                "description": "Required for insert_node. The existing node after which to insert. For add_node it only controls visual placement and creates no connection.",
                            },
                            "before_node_id": {
                                "type": ["string", "null"],
                                "description": "Optional direct downstream node for insert_node. Required when the after node branches to multiple downstream nodes.",
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
                                "description": "Optional input port ID on the new target node. Omit when the app should choose an unambiguous compatible port.",
                            },
                            "output_handle": {
                                "type": ["string", "null"],
                                "description": "Optional output port ID on an inserted node for its downstream reconnection.",
                            },
                            "downstream_handle": {
                                "type": ["string", "null"],
                                "description": "Optional input port ID on insert_node's downstream node.",
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
                            "before_node_id",
                            "source_node_id",
                            "target_node_id",
                            "source_handle",
                            "target_handle",
                            "output_handle",
                            "downstream_handle",
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
    """An action error that can be shown to the assistant without guessing."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "WORKFLOW_ACTION_FAILED",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.details = details or {}


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


def _add_node(
    nodes: list[Any],
    nodes_by_id: dict[str, dict[str, Any]],
    aliases: dict[str, str],
    action: dict[str, Any],
) -> tuple[dict[str, Any], Any]:
    definition = _node_definition(str(action.get("registry_id") or ""))
    node = _make_node(definition, len(nodes), action, nodes_by_id)
    nodes.append(node)
    nodes_by_id[str(node["id"])] = node
    client_id = str(action.get("client_id") or "").strip()
    if client_id:
        aliases[client_id] = str(node["id"])
    return node, definition


_ORDINAL_REFERENCE_RE = re.compile(r"^(?:node|نود)\s*(\d+)$", re.IGNORECASE)


def _node_display_name(node: dict[str, Any]) -> str:
    data = _as_dict(node.get("data"))
    return str(data.get("label") or data.get("typeLabel") or node.get("id") or "")


def _resolve_node_id(value: Any, aliases: dict[str, str], nodes_by_id: dict[str, dict[str, Any]], field: str) -> str:
    raw = str(value or "").strip()
    node_id = aliases.get(raw, raw)
    if node_id and node_id in nodes_by_id:
        return node_id

    ordinal_match = _ORDINAL_REFERENCE_RE.fullmatch(raw)
    if ordinal_match:
        ordinal = int(ordinal_match.group(1))
        node_ids = list(nodes_by_id)
        if 1 <= ordinal <= len(node_ids):
            return node_ids[ordinal - 1]

    normalized = raw.casefold()
    named = [
        node_id
        for node_id, node in nodes_by_id.items()
        if _node_display_name(node).casefold() == normalized
    ]
    if len(named) == 1:
        return named[0]
    if len(named) > 1:
        raise WorkflowActionError(
            f"Ambiguous {field}: '{raw}' matches more than one node.",
            code="AMBIGUOUS_NODE_REFERENCE",
            details={"reference": raw, "nodeIds": named},
        )

    raise WorkflowActionError(
        f"Unknown {field}: {raw or '<empty>'}.",
        code="UNKNOWN_NODE_REFERENCE",
        details={"reference": raw, "availableNodeIds": list(nodes_by_id)},
    )


def _definition_for_instance(node: dict[str, Any]) -> Any:
    data = _as_dict(node.get("data"))
    registry_id = str(data.get("registryId") or data.get("catalogId") or node.get("type") or "").strip()
    return _node_definition(registry_id)


def _port_summary(port: Any) -> dict[str, str]:
    return {
        "id": str(port.id),
        "name": str(port.name or port.id),
        "type": str(port.type),
    }


def _resolve_ports(definition: Any, side: str, requested_handle: Any) -> list[Any]:
    ports = list(definition.outputs if side == "output" else definition.inputs)
    requested = str(requested_handle or "").strip()
    if not requested:
        return ports

    selected = [port for port in ports if str(port.id) == requested]
    if selected:
        return selected

    raise WorkflowActionError(
        f"Unknown {side} port '{requested}' on {definition.name}.",
        code="UNKNOWN_PORT",
        details={
            "node": definition.name,
            "side": side,
            "requestedPort": requested,
            "availablePorts": [_port_summary(port) for port in ports],
        },
    )


def _best_port_pair(
    source_node: dict[str, Any],
    target_node: dict[str, Any],
    source_handle: Any,
    target_handle: Any,
) -> tuple[str, str]:
    source_def = _definition_for_instance(source_node)
    target_def = _definition_for_instance(target_node)
    source_ports = _resolve_ports(source_def, "output", source_handle)
    target_ports = _resolve_ports(target_def, "input", target_handle)
    for source_port in source_ports:
        for target_port in target_ports:
            if compatible(str(source_port.type), str(target_port.type)):
                return str(source_port.id), str(target_port.id)

    raise WorkflowActionError(
        f"No compatible ports between {source_def.name} and {target_def.name}.",
        code="INCOMPATIBLE_PORTS",
        details={
            "sourceNode": source_def.name,
            "targetNode": target_def.name,
            "sourcePorts": [_port_summary(port) for port in source_ports],
            "targetPorts": [_port_summary(port) for port in target_ports],
        },
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

    target_def = _definition_for_instance(nodes_by_id[target_node_id])
    target_port_def = next(
        (port for port in target_def.inputs if str(port.id) == target_port),
        None,
    )
    occupied = [
        str(edge.get("id") or "")
        for edge in edges
        if isinstance(edge, dict)
        and str(edge.get("target") or "") == target_node_id
        and str(edge.get("targetHandle") or "") == target_port
    ]
    if occupied and target_port_def and not bool(getattr(target_port_def, "multiple", False)):
        raise WorkflowActionError(
            f"Input port '{target_port}' on {target_def.name} already has a connection.",
            code="INPUT_ALREADY_CONNECTED",
            details={"node": target_def.name, "port": target_port, "edgeIds": occupied},
        )

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


def _insert_node(
    graph: dict[str, Any],
    operation: dict[str, Any],
    nodes: list[Any],
    nodes_by_id: dict[str, dict[str, Any]],
    aliases: dict[str, str],
) -> dict[str, Any]:
    after_node_id = _resolve_node_id(
        operation.get("after_node_id"), aliases, nodes_by_id, "after_node_id"
    )
    before_reference = operation.get("before_node_id")
    before_node_id = (
        _resolve_node_id(before_reference, aliases, nodes_by_id, "before_node_id")
        if str(before_reference or "").strip()
        else None
    )
    outgoing = [
        edge
        for edge in _as_list(graph.get("edges"))
        if isinstance(edge, dict) and str(edge.get("source") or "") == after_node_id
    ]
    if before_node_id:
        outgoing = [
            edge for edge in outgoing
            if str(edge.get("target") or "") == before_node_id
        ]
        if len(outgoing) != 1:
            raise WorkflowActionError(
                f"No single direct connection exists from '{after_node_id}' to '{before_node_id}'.",
                code="INSERT_PATH_NOT_FOUND",
                details={"afterNodeId": after_node_id, "beforeNodeId": before_node_id},
            )
    elif len(outgoing) > 1:
        raise WorkflowActionError(
            f"Cannot insert after '{after_node_id}' because it has multiple downstream connections.",
            code="AMBIGUOUS_INSERT_PATH",
            details={
                "afterNodeId": after_node_id,
                "downstreamNodeIds": [str(edge.get("target") or "") for edge in outgoing],
            },
        )

    replaced_edge = outgoing[0] if outgoing else None
    placement_action = {**operation, "after_node_id": after_node_id}
    node, definition = _add_node(nodes, nodes_by_id, aliases, placement_action)
    inserted_node_id = str(node["id"])

    upstream_handle = operation.get("source_handle")
    if upstream_handle is None and replaced_edge:
        upstream_handle = replaced_edge.get("sourceHandle")
    _best_port_pair(
        nodes_by_id[after_node_id],
        node,
        upstream_handle,
        operation.get("target_handle"),
    )

    if replaced_edge:
        downstream_node_id = str(replaced_edge.get("target") or "")
        downstream_handle = operation.get("downstream_handle")
        if downstream_handle is None:
            downstream_handle = replaced_edge.get("targetHandle")
        _best_port_pair(
            node,
            nodes_by_id[downstream_node_id],
            operation.get("output_handle"),
            downstream_handle,
        )
        graph["edges"] = [
            edge for edge in _as_list(graph.get("edges"))
            if not (isinstance(edge, dict) and edge is replaced_edge)
        ]

    upstream_edge = _add_edge(
        graph,
        source_node_id=after_node_id,
        target_node_id=inserted_node_id,
        source_handle=upstream_handle,
        target_handle=operation.get("target_handle"),
        nodes_by_id=nodes_by_id,
    )
    summary: dict[str, Any] = {
        "action": "insert_node",
        "nodeId": inserted_node_id,
        "nodeName": definition.name,
        "afterNodeId": after_node_id,
        "edgeId": upstream_edge["id"],
    }
    if replaced_edge:
        downstream_edge = _add_edge(
            graph,
            source_node_id=inserted_node_id,
            target_node_id=str(replaced_edge.get("target") or ""),
            source_handle=operation.get("output_handle"),
            target_handle=(
                operation.get("downstream_handle")
                if operation.get("downstream_handle") is not None
                else replaced_edge.get("targetHandle")
            ),
            nodes_by_id=nodes_by_id,
        )
        summary["replacedEdgeId"] = str(replaced_edge.get("id") or "")
        summary["downstreamEdgeId"] = downstream_edge["id"]
    return summary


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
            placement_action = operation
            if str(operation.get("after_node_id") or "").strip():
                placement_action = {
                    **operation,
                    "after_node_id": _resolve_node_id(
                        operation.get("after_node_id"), aliases, nodes_by_id, "after_node_id"
                    ),
                }
            node, definition = _add_node(nodes, nodes_by_id, aliases, placement_action)
            applied.append({
                "action": action,
                "nodeId": node["id"],
                "nodeName": definition.name,
            })
            continue

        if action == "insert_node":
            applied.append(
                _insert_node(next_graph, operation, nodes, nodes_by_id, aliases)
            )
            edges = _as_list(next_graph.get("edges"))
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
            removed_edges = sum(
                1
                for edge in _as_list(next_graph.get("edges"))
                if isinstance(edge, dict)
                and (
                    str(edge.get("source") or "") == node_id
                    or str(edge.get("target") or "") == node_id
                )
            )
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
            applied.append({"action": action, "nodeId": node_id, "removedEdges": removed_edges})
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
            source_node_id = (
                _resolve_node_id(
                    operation.get("source_node_id"), aliases, nodes_by_id, "source_node_id"
                )
                if str(operation.get("source_node_id") or "").strip()
                else ""
            )
            target_node_id = (
                _resolve_node_id(
                    operation.get("target_node_id"), aliases, nodes_by_id, "target_node_id"
                )
                if str(operation.get("target_node_id") or "").strip()
                else ""
            )
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
            expected_revision=workflow.revision,
        )
    except WorkflowActionError as exc:
        return {
            "changed": False,
            "error": str(exc),
            "code": exc.code,
            "details": exc.details,
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
