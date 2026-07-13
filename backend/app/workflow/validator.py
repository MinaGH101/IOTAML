from __future__ import annotations

from typing import Any
from app.nodes.registry import (
    LEGACY_NODE_ALIASES,
    LEGACY_SOURCE_NODE_TYPES,
    PORT_COMPATIBILITY,
    SOURCE_NODE_IDS,
    canonical_node_id,
    get_node,
)
from app.workflow.graph import topological_sort
from app.workflow.types import ValidationMessage, ValidationResult


def _port_type(node_def: Any, handle: str | None, side: str) -> str:
    ports = node_def.outputs if side == 'source' else node_def.inputs
    if handle:
        for port in ports:
            if port.id == handle:
                return port.type
    return ports[0].type if ports else 'any'


def compatible(source_type: str, target_type: str) -> bool:
    if source_type == target_type or target_type == 'any' or source_type == 'any':
        return True
    return target_type in PORT_COMPATIBILITY.get(source_type, set())


def validate_workflow_graph(graph: dict[str, Any]) -> ValidationResult:
    errors: list[ValidationMessage] = []
    warnings: list[ValidationMessage] = []
    nodes = graph.get('nodes') or []
    edges = graph.get('edges') or []
    by_instance = {str(node.get('id')): node for node in nodes}

    for node in nodes:
        node_id = str(node.get('id'))
        registry_id = str((node.get('data') or {}).get('registryId') or node.get('type') or '')
        canonical_id = canonical_node_id(registry_id)
        node_def = get_node(canonical_id)
        if not node_def:
            errors.append(ValidationMessage(nodeId=node_id, type='unsupported_node_type', message=f'Unsupported node type: {registry_id}', suggestedFix='Replace this node with a registered catalog node.'))
            continue
        params = (node.get('data') or {}).get('params') or {}
        for setting in node_def.settingsSchema:
            if setting.required and params.get(setting.name) in [None, '', []]:
                errors.append(ValidationMessage(nodeId=node_id, type='missing_required_setting', message=f'Missing required setting: {setting.label}', suggestedFix='Open node settings and fill this field.'))
        if node_def.comingSoon and registry_id not in LEGACY_NODE_ALIASES:
            warnings.append(ValidationMessage(level='warning', nodeId=node_id, type='not_implemented_yet', message=f'{node_def.name} is registered but execution is not implemented yet.', suggestedFix='Use it as a design stub or replace it with an MVP node.'))

    for edge in edges:
        edge_id = str(edge.get('id') or '')
        src = str(edge.get('source') or '')
        dst = str(edge.get('target') or '')
        if src not in by_instance or dst not in by_instance:
            errors.append(ValidationMessage(edgeId=edge_id, type='dangling_edge', message='Connection references a missing node.', suggestedFix='Delete the broken connection.'))
            continue
        src_def = get_node(canonical_node_id(str((by_instance[src].get('data') or {}).get('registryId') or by_instance[src].get('type') or '')))
        dst_def = get_node(canonical_node_id(str((by_instance[dst].get('data') or {}).get('registryId') or by_instance[dst].get('type') or '')))
        if not src_def or not dst_def:
            continue
        source_type = _port_type(src_def, edge.get('sourceHandle'), 'source')
        target_type = _port_type(dst_def, edge.get('targetHandle'), 'target')
        if not compatible(source_type, target_type):
            errors.append(ValidationMessage(edgeId=edge_id, type='incompatible_ports', message=f'Cannot connect {source_type} to {target_type}.', suggestedFix='Connect compatible output/input handles.'))

    # Required inputs
    for node in nodes:
        node_id = str(node.get('id'))
        registry_id = str((node.get('data') or {}).get('registryId') or node.get('type') or '')
        canonical_id = canonical_node_id(registry_id)
        node_def = get_node(canonical_id)
        if not node_def:
            continue
        incoming = [edge for edge in edges if str(edge.get('target')) == node_id]
        # Trigger/file/source nodes may intentionally have no incoming connection.
        if any(port.required for port in node_def.inputs) and not incoming and canonical_id not in SOURCE_NODE_IDS and registry_id not in LEGACY_SOURCE_NODE_TYPES:
            warnings.append(ValidationMessage(level='warning', nodeId=node_id, type='missing_input_connection', message=f'{node_def.name} has no input connection.', suggestedFix='Connect it to an upstream node if it needs previous output.'))

    try:
        topological_sort(nodes, edges)
    except ValueError as exc:
        errors.append(ValidationMessage(type='circular_dependency', message=str(exc), suggestedFix='Remove one connection in the cycle.'))

    return ValidationResult(valid=not errors, errors=errors, warnings=warnings)
