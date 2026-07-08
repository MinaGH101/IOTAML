from __future__ import annotations

from pathlib import Path
from typing import Any

from app.nodes.io import node_label, output, safe_json
from app.nodes.registry import get_node_runner
from app.workflow.expressions import resolve_settings
from app.workflow.graph import node_registry_id, topological_sort, upstream_outputs
from app.workflow.runtime_context import RuntimeContext
from app.workflow.validator import validate_workflow_graph

LEGACY_PREFIXES = ('data_', 'transform_', 'analysis_', 'model_')


def get_params(node: dict[str, Any], ctx: RuntimeContext) -> dict[str, Any]:
    params = (node.get('data') or {}).get('params') or {}
    return resolve_settings(params, ctx.expression_context())


def registry_id(node: dict[str, Any]) -> str:
    return node_registry_id(node)


def apply_node(node: dict[str, Any], inputs: dict[str, Any], ctx: RuntimeContext) -> dict[str, Any]:
    rid = registry_id(node)
    nid = str(node['id'])
    label = node_label(node)
    node_runner = get_node_runner(rid)
    if not node_runner:
        raise ValueError(f'Unsupported node type: {rid}')
    if not node_runner.implemented:
        return {'output': output(nid, label, 'json', value={'status': 'not_implemented_yet', 'message': f'{node_runner.name} is registered but execution is not implemented yet.'})}
    params = get_params(node, ctx)
    node_runner.validate_settings(params)
    return node_runner.run(node, inputs, params, ctx)


def visible_node_output(value: Any) -> Any:
    if not isinstance(value, dict):
        return None
    outputs = value.get('outputs')
    if isinstance(outputs, list):
        return outputs
    output_value = value.get('output')
    return output_value


def execute_scientific_workflow(graph: dict[str, Any], dataset_id: int | None, target_column: str | None, task_type: str, project_id: int | None, execution_id: int | str) -> dict[str, Any]:
    validation = validate_workflow_graph(graph)
    if not validation.valid:
        raise ValueError('; '.join(msg.message for msg in validation.errors))
    nodes = graph.get('nodes') or []
    edges = graph.get('edges') or []
    by_id = {str(node['id']): node for node in nodes}
    order = topological_sort(nodes, edges)
    run_path = Path('storage') / 'runs' / str(execution_id)
    ctx = RuntimeContext(execution_id=execution_id, project_id=project_id, dataset_id=dataset_id, target_column=target_column, task_type=task_type, run_path=run_path)
    node_outputs: dict[str, Any] = {}
    errors: list[dict[str, Any]] = []
    for node_id in order:
        node = by_id[node_id]
        try:
            inputs = upstream_outputs(node_id, edges, node_outputs)
            result = apply_node(node, inputs, ctx)
            node_outputs[node_id] = result
            ctx.node_outputs[node_id] = result
            label = (node.get('data') or {}).get('label')
            if label:
                ctx.node_outputs[str(label)] = result
        except Exception as exc:
            errors.append({'node_id': node_id, 'node_name': node_label(node), 'error_type': exc.__class__.__name__, 'message': str(exc), 'suggested_fix': 'Check node settings, input connections, and required columns.'})
            node_outputs[node_id] = {'output': output(node_id, node_label(node), 'json', error=str(exc), error_type=exc.__class__.__name__)}
            ctx.node_outputs[node_id] = node_outputs[node_id]
            break
    artifacts = {
        'node_outputs': {
            nid: visible
            for nid, value in node_outputs.items()
            if (visible := visible_node_output(value))
        },
        'errors': errors,
        'validation_warnings': [w.model_dump() for w in validation.warnings],
    }
    metrics = {'nodes_total': len(nodes), 'nodes_executed': len(node_outputs), 'errors': len(errors), 'status': 'failed' if errors else 'success'}
    return {'metrics': safe_json(metrics), 'artifacts': safe_json(artifacts), 'error': errors[0]['message'] if errors else None}


def is_legacy_graph(graph: dict[str, Any]) -> bool:
    return any(registry_id(node).startswith(LEGACY_PREFIXES) for node in graph.get('nodes') or [])
