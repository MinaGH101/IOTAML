from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Callable

from app.nodes.io import dataframe_payload, metrics_output, node_label, output, safe_json, table_output
from app.nodes.registry import get_node_runner
from app.services.node_cache_runtime import RuntimeNodeCache
from app.services.run_state import RunCancelledError
from app.workflow.component_runtime import execute_component, is_component_node
from app.workflow.expressions import resolve_settings
from app.workflow.graph import node_registry_id, topological_sort, upstream_outputs
from app.workflow.runtime_context import RuntimeContext
from app.workflow.validator import validate_workflow_graph

LEGACY_PREFIXES = ('data_', 'transform_', 'analysis_', 'model_')
ProgressCallback = Callable[..., None]


def get_params(node: dict[str, Any], ctx: RuntimeContext) -> dict[str, Any]:
    params = (node.get('data') or {}).get('params') or {}
    return resolve_settings(params, ctx.expression_context())


def registry_id(node: dict[str, Any]) -> str:
    return node_registry_id(node)


def apply_node(
    node: dict[str, Any],
    inputs: dict[str, Any],
    ctx: RuntimeContext,
    params: dict[str, Any] | None = None,
    *,
    runtime_cache: RuntimeNodeCache | None = None,
    progress_callback: ProgressCallback | None = None,
    cancel_check: Callable[[], bool] | None = None,
) -> dict[str, Any]:
    resolved = params if params is not None else get_params(node, ctx)
    if is_component_node(node):
        return execute_component(
            node, inputs, ctx, resolved, apply_node=apply_node, runtime_cache=runtime_cache,
            progress_callback=progress_callback, cancel_check=cancel_check,
        )
    rid = registry_id(node)
    nid = str(node['id'])
    label = node_label(node)
    node_runner = get_node_runner(rid)
    if not node_runner:
        raise ValueError(f'Unsupported node type: {rid}')
    if not node_runner.implemented:
        return {'output': output(nid, label, 'json', value={'status': 'not_implemented_yet', 'message': f'{node_runner.name} is registered but execution is not implemented yet.'})}
    node_runner.validate_settings(resolved)
    return node_runner.run(node, inputs, resolved, ctx)


def _visible_output_items(value: dict[str, Any]) -> list[dict[str, Any]]:
    outputs = value.get('outputs')
    if isinstance(outputs, list):
        return [item for item in outputs if isinstance(item, dict)]
    single = value.get('output')
    return [single] if isinstance(single, dict) else []


def _port_candidates(value: dict[str, Any], port_id: str) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    by_port = value.get('outputs_by_port')
    port_value = by_port.get(port_id) if isinstance(by_port, dict) else None
    if port_value is None and port_id in value:
        port_value = value.get(port_id)
    if isinstance(port_value, dict):
        nested = port_value.get('outputs')
        if isinstance(nested, list):
            candidates.extend(item for item in nested if isinstance(item, dict))
        nested_single = port_value.get('output')
        if isinstance(nested_single, dict):
            candidates.append(nested_single)
        if isinstance(port_value.get('kind'), str):
            candidates.append(port_value)
    return candidates


def _port_value(value: dict[str, Any], port_id: str) -> Any:
    by_port = value.get('outputs_by_port')
    if isinstance(by_port, dict) and port_id in by_port:
        return by_port[port_id]
    return value.get(port_id)


def _dataframe_columns_for_port(value: dict[str, Any], port_id: str) -> list[str]:
    payload = dataframe_payload({'port': _port_value(value, port_id)})
    return [str(column) for column in payload.df.columns] if payload else []


def _output_kind_matches_port(kind: str, port_type: str) -> bool:
    if port_type == 'dataframe':
        return kind == 'table'
    if port_type == 'plot':
        return kind in {'plot_group', 'bar_plot', 'scatter', 'histogram', 'heatmap', 'pp_plot', 'stair_outlier', 'line', 'bar'}
    if port_type == 'metrics':
        return kind == 'metrics'
    if port_type in {'json', 'json_items', 'schema', 'report'}:
        return kind in {'json', 'table', 'metrics'}
    return False


def _annotate_port_output(item: dict[str, Any], port: dict[str, Any]) -> dict[str, Any]:
    current = dict(item)
    port_id = str(port.get('id') or '')
    current['source_handle'] = port_id
    current['source_port_name'] = str(port.get('name') or port_id)
    return current


def _visible_outputs_from_declared_ports(node: dict[str, Any], value: dict[str, Any], ports: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build visible outputs from the actual declared port values.

    This is authoritative for multi-output nodes. It prevents a report preview
    from being assigned to a dataframe port merely because both happen to be
    rendered as tables or because their list positions match.
    """
    result: list[dict[str, Any]] = []
    node_id = str(node.get('id'))
    label = node_label(node)

    for port in ports:
        port_id = str(port.get('id') or '')
        if not port_id:
            continue
        port_value = _port_value(value, port_id)
        if port_value is None:
            continue

        candidates = _port_candidates(value, port_id)
        if candidates:
            result.extend(_annotate_port_output(candidate, port) for candidate in candidates)
            continue

        port_type = str(port.get('type') or 'any')
        payload = dataframe_payload({'port': port_value})
        if port_type == 'dataframe' and payload:
            preview = table_output(node_id, f"{label} · {str(port.get('name') or port_id)}", payload.df, 100)
            result.append(_annotate_port_output(preview, port))
            continue

        if isinstance(port_value, dict):
            nested_output = port_value.get('output')
            if isinstance(nested_output, dict):
                result.append(_annotate_port_output(nested_output, port))
                continue
            if isinstance(port_value.get('kind'), str):
                result.append(_annotate_port_output(port_value, port))
                continue

        if port_type == 'metrics' and isinstance(port_value, dict):
            result.append(_annotate_port_output(metrics_output(node_id, f"{label} · {str(port.get('name') or port_id)}", safe_json(port_value)), port))
            continue

        if port_type in {'json', 'json_items', 'schema', 'report', 'any'}:
            visible = output(node_id, f"{label} · {str(port.get('name') or port_id)}", 'json', value=safe_json(port_value))
            result.append(_annotate_port_output(visible, port))

    return result


def visible_node_output(node: dict[str, Any], value: Any) -> Any:
    if not isinstance(value, dict):
        return None
    raw_single = value.get('output')
    if raw_single is not None and not isinstance(raw_single, dict) and not isinstance(value.get('outputs'), list):
        return raw_single
    visible = _visible_output_items(value)
    if not visible:
        return None

    data = node.get('data') or {}
    ports = data.get('outputs') if isinstance(data.get('outputs'), list) else []
    if not ports:
        runner = get_node_runner(registry_id(node))
        ports = [port.__dict__ for port in runner.outputs] if runner else []

    port_outputs = _visible_outputs_from_declared_ports(node, value, ports)
    if port_outputs:
        return port_outputs if len(port_outputs) > 1 else port_outputs[0]

    annotated: list[dict[str, Any]] = []
    for index, item in enumerate(visible):
        current = dict(item)
        handle = str(current.get('source_handle') or '').strip()
        if not handle:
            exact_matches: list[str] = []
            for port in ports:
                port_id = str(port.get('id') or '')
                if not port_id:
                    continue
                for candidate in _port_candidates(value, port_id):
                    if candidate is item or candidate == item:
                        exact_matches.append(port_id)
                        break
            if len(exact_matches) == 1:
                handle = exact_matches[0]
        if not handle and str(current.get('kind') or '') == 'table':
            visible_columns = [str(column) for column in current.get('columns') or []]
            schema_matches = [
                str(port.get('id')) for port in ports
                if str(port.get('type') or '') == 'dataframe'
                and visible_columns
                and _dataframe_columns_for_port(value, str(port.get('id') or '')) == visible_columns
            ]
            if len(schema_matches) == 1:
                handle = schema_matches[0]
        if not handle:
            kind = str(current.get('kind') or '')
            kind_matches = [str(port.get('id')) for port in ports if _output_kind_matches_port(kind, str(port.get('type') or ''))]
            if len(kind_matches) == 1:
                handle = kind_matches[0]
        if not handle and len(ports) == len(visible) and index < len(ports):
            handle = str(ports[index].get('id') or '')
        if not handle and len(ports) == 1:
            handle = str(ports[0].get('id') or '')
        if handle:
            current['source_handle'] = handle
            port = next((port for port in ports if str(port.get('id')) == handle), None)
            if port:
                current['source_port_name'] = str(port.get('name') or handle)
        annotated.append(current)

    used_handles = {str(item.get('source_handle') or '') for item in annotated}
    for port in ports:
        port_id = str(port.get('id') or '')
        if not port_id or port_id in used_handles or str(port.get('type') or '') != 'dataframe':
            continue
        payload = dataframe_payload({'port': _port_value(value, port_id)})
        if not payload:
            continue
        preview = table_output(
            str(node.get('id')),
            f"{node_label(node)} · {str(port.get('name') or port_id)}",
            payload.df,
            100,
        )
        preview['source_handle'] = port_id
        preview['source_port_name'] = str(port.get('name') or port_id)
        annotated.append(preview)
    return annotated if len(annotated) > 1 else annotated[0]


def execute_scientific_workflow(
    graph: dict[str, Any],
    dataset_id: int | None,
    target_column: str | None,
    task_type: str,
    project_id: int | None,
    execution_id: int | str,
    *,
    dataset_path: str | None = None,
    progress_callback: ProgressCallback | None = None,
    cancel_check: Callable[[], bool] | None = None,
    runtime_cache: RuntimeNodeCache | None = None,
) -> dict[str, Any]:
    validation = validate_workflow_graph(graph)
    if not validation.valid:
        raise ValueError('; '.join(msg.message for msg in validation.errors))
    nodes = graph.get('nodes') or []
    edges = graph.get('edges') or []
    by_id = {str(node['id']): node for node in nodes}
    order = topological_sort(nodes, edges)
    run_path = Path('storage') / 'runs' / str(execution_id)
    ctx = RuntimeContext(execution_id=execution_id, project_id=project_id, dataset_id=dataset_id, dataset_path=dataset_path, target_column=target_column, task_type=task_type, run_path=run_path)
    node_outputs: dict[str, Any] = {}
    errors: list[dict[str, Any]] = []
    cache_hits = 0

    for node_id in order:
        node = by_id[node_id]
        if cancel_check and cancel_check():
            if progress_callback:
                progress_callback(node_id, 'cancelled', 'Cancellation requested.')
            raise RunCancelledError('Cancellation requested.')
        if progress_callback:
            progress_callback(node_id, 'running', None)
        started = time.time()
        try:
            inputs = upstream_outputs(node_id, edges, node_outputs)
            params = get_params(node, ctx)
            parent_refs = runtime_cache.parent_refs(node_id, edges) if runtime_cache else []
            cached_result = None
            cache_meta: dict[str, Any] = {}
            if runtime_cache:
                cached_result, cache_meta = runtime_cache.lookup(node, params, parent_refs)
            if cached_result is not None:
                result = cached_result
                cache_hits += 1
                if progress_callback:
                    progress_callback(node_id, 'cached', None, cache_meta)
            else:
                result = apply_node(node, inputs, ctx, params, runtime_cache=runtime_cache, progress_callback=progress_callback, cancel_check=cancel_check)
                finished = time.time()
                cache_record = runtime_cache.store(node, result, params, parent_refs, {
                    'started_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(started)),
                    'finished_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(finished)),
                    'duration_ms': round((finished - started) * 1000),
                }) if runtime_cache else None
                if progress_callback:
                    progress_callback(node_id, 'succeeded', None, cache_record or cache_meta)
            node_outputs[node_id] = result
            ctx.node_outputs[node_id] = result
            label = (node.get('data') or {}).get('label')
            if label:
                ctx.node_outputs[str(label)] = result
        except RunCancelledError:
            raise
        except Exception as exc:
            if progress_callback:
                progress_callback(node_id, 'failed', str(exc))
            errors.append({'node_id': node_id, 'node_name': node_label(node), 'error_type': exc.__class__.__name__, 'message': str(exc), 'suggested_fix': 'Check node settings, input connections, and required columns.'})
            node_outputs[node_id] = {'output': output(node_id, node_label(node), 'json', error=str(exc), error_type=exc.__class__.__name__)}
            ctx.node_outputs[node_id] = node_outputs[node_id]
            break

    artifacts = {
        'node_outputs': {nid: visible for nid, value in node_outputs.items() if (visible := visible_node_output(by_id[nid], value))},
        'errors': errors,
        'validation_warnings': [w.model_dump() for w in validation.warnings],
    }
    metrics = {
        'nodes_total': len(nodes),
        'nodes_executed': len(node_outputs),
        'cache_hits': cache_hits,
        'cache_misses': max(0, len(node_outputs) - cache_hits),
        'errors': len(errors),
        'status': 'failed' if errors else 'success',
    }
    return {'metrics': safe_json(metrics), 'artifacts': safe_json(artifacts), 'error': errors[0]['message'] if errors else None}


def is_legacy_graph(graph: dict[str, Any]) -> bool:
    return any(registry_id(node).startswith(LEGACY_PREFIXES) for node in graph.get('nodes') or [])
