"""Graph-level validation for nodes, settings, ports, connections, and cycles."""

from __future__ import annotations

from collections import Counter, defaultdict
from types import SimpleNamespace
from typing import Any

from app.nodes.registry import (
    LEGACY_NODE_ALIASES,
    LEGACY_SOURCE_NODE_TYPES,
    PORT_COMPATIBILITY,
    SOURCE_NODE_IDS,
    canonical_node_id,
    get_node,
)
from app.workflow.contracts.types import ValidationMessage, ValidationResult
from app.workflow.execution.component_runtime import component_ports, component_settings, is_component_node
from app.workflow.graph.operations import topological_sort


def _port(node_def: Any, handle: str | None, side: str) -> Any | None:
    ports = node_def.outputs if side == "source" else node_def.inputs
    if handle:
        return next((port for port in ports if str(port.id) == str(handle)), None)
    return ports[0] if ports else None


def compatible(source_type: str, target_type: str) -> bool:
    if source_type == target_type or target_type == "any" or source_type == "any":
        return True
    return target_type in PORT_COMPATIBILITY.get(source_type, set())


def _component_definition(node: dict[str, Any]) -> Any:
    def ports(side: str) -> list[Any]:
        return [
            SimpleNamespace(
                id=str(item.get("id")),
                name=str(item.get("name") or item.get("id")),
                type=str(item.get("type") or "any"),
                required=bool(item.get("required", side == "inputs")),
                multiple=bool(item.get("multiple", False)),
            )
            for item in component_ports(node, side)
        ]

    settings = [
        SimpleNamespace(
            name=str(item.get("id")),
            label=str(item.get("name") or item.get("id")),
            type=str(item.get("type") or "text"),
            required=bool(item.get("required", False)),
            options=list(item.get("options") or []),
        )
        for item in component_settings(node)
    ]
    snapshot = (node.get("data") or {}).get("componentSnapshot") or {}
    return SimpleNamespace(
        id=str((node.get("data") or {}).get("registryId") or ""),
        name=str(snapshot.get("component_name") or (node.get("data") or {}).get("typeLabel") or "Component"),
        inputs=ports("inputs"),
        outputs=ports("outputs"),
        settingsSchema=settings,
        comingSoon=False,
        implemented=True,
    )


def _definition(node: dict[str, Any]) -> Any:
    if is_component_node(node):
        return _component_definition(node)
    registry_id = str((node.get("data") or {}).get("registryId") or node.get("type") or "")
    return get_node(canonical_node_id(registry_id))


def _is_dynamic(value: Any) -> bool:
    return isinstance(value, dict) and value.get("mode") == "dynamic"


def _setting_type_valid(kind: str, value: Any) -> bool:
    if value is None or _is_dynamic(value):
        return True
    normalized = kind.lower()
    if normalized in {"integer", "int"}:
        return isinstance(value, int) and not isinstance(value, bool)
    if normalized in {"number", "float"}:
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if normalized in {"boolean", "bool"}:
        return isinstance(value, bool)
    if normalized in {"multiselect", "columns", "list", "tags"}:
        return isinstance(value, list)
    if normalized in {"json", "object", "mapping"}:
        return isinstance(value, (dict, list, str))
    if normalized in {"text", "string", "select", "column", "code", "textarea", "file", "dataset"}:
        return isinstance(value, str)
    return True


def validate_workflow_graph(
    graph: dict[str, Any],
    component_interface: dict[str, Any] | None = None,
    *,
    require_settings: bool = True,
    require_connections: bool = True,
) -> ValidationResult:
    errors: list[ValidationMessage] = []
    warnings: list[ValidationMessage] = []
    if not isinstance(graph, dict):
        return ValidationResult(valid=False, errors=[ValidationMessage(type="invalid_graph", message="Workflow graph must be an object.", suggestedFix="Submit an object with nodes and edges arrays.")], warnings=[])

    nodes_raw = graph.get("nodes", [])
    edges_raw = graph.get("edges", [])
    if not isinstance(nodes_raw, list) or not isinstance(edges_raw, list):
        return ValidationResult(valid=False, errors=[ValidationMessage(type="invalid_graph", message="Workflow nodes and edges must be arrays.", suggestedFix="Repair the saved workflow graph structure.")], warnings=[])
    nodes = [item for item in nodes_raw if isinstance(item, dict)]
    edges = [item for item in edges_raw if isinstance(item, dict)]
    if len(nodes) != len(nodes_raw) or len(edges) != len(edges_raw):
        errors.append(ValidationMessage(type="invalid_graph_item", message="Every node and edge must be an object.", suggestedFix="Remove malformed graph entries."))

    node_ids = [str(node.get("id") or "") for node in nodes]
    edge_ids = [str(edge.get("id") or "") for edge in edges]
    for node_id, count in Counter(node_ids).items():
        if not node_id:
            errors.append(ValidationMessage(type="missing_node_id", message="A workflow node has no ID.", suggestedFix="Recreate the malformed node."))
        elif count > 1:
            errors.append(ValidationMessage(nodeId=node_id, type="duplicate_node_id", message=f"Node ID '{node_id}' occurs more than once.", suggestedFix="Assign unique node IDs."))
    for edge_id, count in Counter(edge_ids).items():
        if not edge_id:
            errors.append(ValidationMessage(type="missing_edge_id", message="A workflow edge has no ID.", suggestedFix="Reconnect the malformed edge."))
        elif count > 1:
            errors.append(ValidationMessage(edgeId=edge_id, type="duplicate_edge_id", message=f"Edge ID '{edge_id}' occurs more than once.", suggestedFix="Assign unique edge IDs."))

    by_instance = {str(node.get("id")): node for node in nodes if node.get("id") is not None}
    boundary_targets = {
        (str(item.get("internal_node_id")), str(item.get("internal_handle") or "input"))
        for item in ((component_interface or {}).get("inputs") or [])
    }
    definitions: dict[str, Any] = {}

    for node in nodes:
        node_id = str(node.get("id") or "")
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        registry_id = str(data.get("registryId") or node.get("type") or "")
        try:
            node_def = _definition(node)
        except (TypeError, ValueError) as exc:
            errors.append(ValidationMessage(nodeId=node_id, type="invalid_component_snapshot", message=str(exc), suggestedFix="Reinsert or upgrade the component from the library."))
            continue
        if not node_def:
            errors.append(ValidationMessage(nodeId=node_id, type="unsupported_node_type", message=f"Unsupported node type: {registry_id}", suggestedFix="Replace this node with a registered catalog node."))
            continue
        definitions[node_id] = node_def
        if not getattr(node_def, "implemented", True) and registry_id not in LEGACY_NODE_ALIASES:
            errors.append(ValidationMessage(nodeId=node_id, type="node_implementation_unavailable", message=f"{node_def.name} has no executable backend implementation.", suggestedFix="Replace the node or install a compatible backend version."))

        params = data.get("params") if isinstance(data.get("params"), dict) else {}
        if require_settings:
            for setting in node_def.settingsSchema:
                value = params.get(setting.name)
                if setting.required and value in [None, "", []]:
                    errors.append(ValidationMessage(nodeId=node_id, type="missing_required_setting", message=f"Required setting '{setting.label}' is empty.", suggestedFix=f"Open node settings and fill '{setting.label}'.", field=setting.name, expected="a non-empty value", actual=value))
                    continue
                if setting.name in params and not _setting_type_valid(str(getattr(setting, "type", "")), value):
                    errors.append(ValidationMessage(nodeId=node_id, type="invalid_setting_type", message=f"Setting '{setting.label}' has an invalid value type.", suggestedFix="Choose a value matching the node catalog.", field=setting.name, expected=str(getattr(setting, "type", "value")), actual=type(value).__name__))
                options = list(getattr(setting, "options", []) or [])
                if options and value not in [None, "", []] and not _is_dynamic(value):
                    values = value if isinstance(value, list) else [value]
                    invalid = [item for item in values if item not in options]
                    if invalid:
                        errors.append(ValidationMessage(nodeId=node_id, type="invalid_setting_choice", message=f"Setting '{setting.label}' contains an unsupported choice.", suggestedFix="Select one of the allowed catalog values.", field=setting.name, expected=options, actual=invalid))

    incoming_by_port: dict[tuple[str, str], list[str]] = defaultdict(list)
    for edge in edges:
        edge_id = str(edge.get("id") or "")
        src = str(edge.get("source") or "")
        dst = str(edge.get("target") or "")
        if src not in by_instance or dst not in by_instance:
            errors.append(ValidationMessage(edgeId=edge_id, type="dangling_edge", message="Connection references a missing node.", suggestedFix="Delete the broken connection.", expected="existing source and target nodes", actual={"source": src, "target": dst}))
            continue
        src_def = definitions.get(src)
        dst_def = definitions.get(dst)
        if not src_def or not dst_def:
            continue
        source_handle = str(edge.get("sourceHandle") or (src_def.outputs[0].id if src_def.outputs else ""))
        target_handle = str(edge.get("targetHandle") or (dst_def.inputs[0].id if dst_def.inputs else ""))
        source_port = _port(src_def, source_handle, "source")
        target_port = _port(dst_def, target_handle, "target")
        if not source_port:
            errors.append(ValidationMessage(edgeId=edge_id, nodeId=src, type="invalid_output_port", message=f"Output port '{source_handle}' does not exist.", suggestedFix="Reconnect the edge to a declared output port.", port=source_handle))
            continue
        if not target_port:
            errors.append(ValidationMessage(edgeId=edge_id, nodeId=dst, type="invalid_input_port", message=f"Input port '{target_handle}' does not exist.", suggestedFix="Reconnect the edge to a declared input port.", port=target_handle))
            continue
        incoming_by_port[(dst, target_handle)].append(edge_id)
        if len(incoming_by_port[(dst, target_handle)]) > 1 and not bool(getattr(target_port, "multiple", False)):
            errors.append(ValidationMessage(edgeId=edge_id, nodeId=dst, type="multiple_edges_single_input", message=f"Input port '{target_handle}' accepts only one connection.", suggestedFix="Remove extra connections or use a multi-input node.", port=target_handle, actual=incoming_by_port[(dst, target_handle)]))
        if not compatible(str(source_port.type), str(target_port.type)):
            errors.append(ValidationMessage(edgeId=edge_id, nodeId=dst, type="incompatible_ports", message=f"Cannot connect {source_port.type} to {target_port.type}.", suggestedFix="Connect an output whose type is accepted by the target input.", port=target_handle, expected=target_port.type, actual=source_port.type, details={"source_node_id": src, "source_handle": source_handle, "target_handle": target_handle}))

    for node in nodes:
        node_id = str(node.get("id") or "")
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        registry_id = str(data.get("registryId") or node.get("type") or "")
        node_def = definitions.get(node_id)
        if not node_def:
            continue
        covered_handles = {handle for target, handle in boundary_targets if target == node_id}
        required = [port for port in node_def.inputs if port.required and port.id not in covered_handles]
        if required and canonical_node_id(registry_id) not in SOURCE_NODE_IDS and registry_id not in LEGACY_SOURCE_NODE_TYPES:
            missing = [port for port in required if (node_id, str(port.id)) not in incoming_by_port]
            if missing:
                labels = ", ".join(str(port.name or port.id) for port in missing)
                message = ValidationMessage(level="error" if require_connections else "warning", nodeId=node_id, type="missing_required_input_connection", message=f"{node_def.name} requires an input connection: {labels}.", suggestedFix="Connect the required input to an upstream node before running.", port=", ".join(str(port.id) for port in missing), expected="connected compatible value", actual="disconnected")
                (errors if require_connections else warnings).append(message)

    try:
        topological_sort(nodes, edges)
    except ValueError as exc:
        errors.append(ValidationMessage(type="circular_dependency", message=str(exc), suggestedFix="Remove one connection in the cycle."))

    return ValidationResult(valid=not errors, errors=errors, warnings=warnings)
