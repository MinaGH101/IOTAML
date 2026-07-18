from __future__ import annotations

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
from app.workflow.component_runtime import component_ports, component_settings, is_component_node
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


def _component_definition(node: dict[str, Any]):
    def ports(side: str):
        return [SimpleNamespace(
            id=str(item.get('id')),
            name=str(item.get('name') or item.get('id')),
            type=str(item.get('type') or 'any'),
            required=bool(item.get('required', side == 'inputs')),
            multiple=bool(item.get('multiple', False)),
        ) for item in component_ports(node, side)]
    settings = [SimpleNamespace(
        name=str(item.get('id')),
        label=str(item.get('name') or item.get('id')),
        required=bool(item.get('required', False)),
    ) for item in component_settings(node)]
    snapshot = (node.get('data') or {}).get('componentSnapshot') or {}
    return SimpleNamespace(
        id=str((node.get('data') or {}).get('registryId') or ''),
        name=str(snapshot.get('component_name') or (node.get('data') or {}).get('typeLabel') or 'Component'),
        inputs=ports('inputs'), outputs=ports('outputs'), settingsSchema=settings,
        comingSoon=False,
    )


def _definition(node: dict[str, Any]):
    if is_component_node(node):
        return _component_definition(node)
    registry_id = str((node.get('data') or {}).get('registryId') or node.get('type') or '')
    return get_node(canonical_node_id(registry_id))


def validate_workflow_graph(graph: dict[str, Any], component_interface: dict[str, Any] | None = None) -> ValidationResult:
    errors: list[ValidationMessage] = []
    warnings: list[ValidationMessage] = []
    nodes = graph.get('nodes') or []
    edges = graph.get('edges') or []
    by_instance = {str(node.get('id')): node for node in nodes}
    boundary_targets = {
        (str(item.get('internal_node_id')), str(item.get('internal_handle') or 'input'))
        for item in ((component_interface or {}).get('inputs') or [])
    }

    for node in nodes:
        node_id = str(node.get('id'))
        registry_id = str((node.get('data') or {}).get('registryId') or node.get('type') or '')
        try:
            node_def = _definition(node)
        except (TypeError, ValueError) as exc:
            errors.append(ValidationMessage(nodeId=node_id, type='invalid_component_snapshot', message=str(exc), suggestedFix='Reinsert or upgrade the component from the library.'))
            continue
        if not node_def:
            errors.append(ValidationMessage(nodeId=node_id, type='unsupported_node_type', message=f'Unsupported node type: {registry_id}', suggestedFix='Replace this node with a registered catalog node.'))
            continue
        params = (node.get('data') or {}).get('params') or {}
        for setting in node_def.settingsSchema:
            if setting.required and params.get(setting.name) in [None, '', []]:
                errors.append(ValidationMessage(nodeId=node_id, type='missing_required_setting', message=f'Missing required setting: {setting.label}', suggestedFix='Open node settings and fill this field.'))
        if getattr(node_def, 'comingSoon', False) and registry_id not in LEGACY_NODE_ALIASES:
            warnings.append(ValidationMessage(level='warning', nodeId=node_id, type='not_implemented_yet', message=f'{node_def.name} is registered but execution is not implemented yet.', suggestedFix='Use it as a design stub or replace it with an MVP node.'))

    for edge in edges:
        edge_id = str(edge.get('id') or '')
        src = str(edge.get('source') or '')
        dst = str(edge.get('target') or '')
        if src not in by_instance or dst not in by_instance:
            errors.append(ValidationMessage(edgeId=edge_id, type='dangling_edge', message='Connection references a missing node.', suggestedFix='Delete the broken connection.'))
            continue
        try:
            src_def = _definition(by_instance[src])
            dst_def = _definition(by_instance[dst])
        except (TypeError, ValueError):
            continue
        if not src_def or not dst_def:
            continue
        source_type = _port_type(src_def, edge.get('sourceHandle'), 'source')
        target_type = _port_type(dst_def, edge.get('targetHandle'), 'target')
        if not compatible(source_type, target_type):
            errors.append(ValidationMessage(edgeId=edge_id, type='incompatible_ports', message=f'Cannot connect {source_type} to {target_type}.', suggestedFix='Connect compatible output/input handles.'))

    for node in nodes:
        node_id = str(node.get('id'))
        registry_id = str((node.get('data') or {}).get('registryId') or node.get('type') or '')
        try:
            node_def = _definition(node)
        except (TypeError, ValueError):
            continue
        if not node_def:
            continue
        incoming = [edge for edge in edges if str(edge.get('target')) == node_id]
        covered_handles = {handle for target, handle in boundary_targets if target == node_id}
        required = [port for port in node_def.inputs if port.required and port.id not in covered_handles]
        if required and not incoming and canonical_node_id(registry_id) not in SOURCE_NODE_IDS and registry_id not in LEGACY_SOURCE_NODE_TYPES:
            warnings.append(ValidationMessage(level='warning', nodeId=node_id, type='missing_input_connection', message=f'{node_def.name} has no input connection.', suggestedFix='Connect it to an upstream node if it needs previous output.'))

    try:
        topological_sort(nodes, edges)
    except ValueError as exc:
        errors.append(ValidationMessage(type='circular_dependency', message=str(exc), suggestedFix='Remove one connection in the cycle.'))

    return ValidationResult(valid=not errors, errors=errors, warnings=warnings)
