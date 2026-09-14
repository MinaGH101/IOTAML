"""Compose the persistent workflow execution state after a successful partial run."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict, deque
from typing import Any

_VOLATILE_OUTPUT_KEYS = {
    'artifact_id',
    'cache_entry_id',
    'created_at',
    'finished_at',
    'run_id',
    'source_run_id',
    'started_at',
    'timestamp',
    'updated_at',
}
_VOLATILE_NODE_DATA_KEYS = {
    'description',
    'label',
    'onRename',
    'runtimeInfo',
    'runtimeStatus',
    'typeLabel',
}


def _normalized(value: Any, *, output: bool = False) -> Any:
    if isinstance(value, dict):
        ignored = _VOLATILE_OUTPUT_KEYS if output else set()
        return {
            str(key): _normalized(child, output=output)
            for key, child in sorted(value.items(), key=lambda item: str(item[0]))
            if str(key) not in ignored
        }
    if isinstance(value, list):
        return [_normalized(item, output=output) for item in value]
    return value


def _digest(value: Any, *, output: bool = False) -> str:
    payload = json.dumps(
        _normalized(value, output=output),
        ensure_ascii=False,
        sort_keys=True,
        separators=(',', ':'),
        default=str,
    ).encode('utf-8')
    return hashlib.sha256(payload).hexdigest()


def _nodes(graph: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(node.get('id')): node
        for node in (graph.get('nodes') or [])
        if node.get('id') is not None
    }


def _incoming_edges(graph: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    incoming: dict[str, list[dict[str, str]]] = defaultdict(list)
    for edge in graph.get('edges') or []:
        target = str(edge.get('target') or '')
        if not target:
            continue
        incoming[target].append({
            'source': str(edge.get('source') or ''),
            'sourceHandle': str(edge.get('sourceHandle') or ''),
            'targetHandle': str(edge.get('targetHandle') or ''),
        })
    for edges in incoming.values():
        edges.sort(key=lambda item: (item['source'], item['sourceHandle'], item['targetHandle']))
    return incoming


def _node_signature(
    node_id: str,
    graph: dict[str, Any],
    nodes: dict[str, dict[str, Any]],
    incoming: dict[str, list[dict[str, str]]],
) -> str | None:
    node = nodes.get(node_id)
    if node is None:
        return None
    data = dict(node.get('data') or {})
    for key in _VOLATILE_NODE_DATA_KEYS:
        data.pop(key, None)
    return _digest({
        'type': node.get('type'),
        'data': data,
        'incoming': incoming.get(node_id, []),
        'meta': {
            'datasetId': (graph.get('meta') or {}).get('datasetId'),
            'targetColumn': (graph.get('meta') or {}).get('targetColumn'),
            'taskType': (graph.get('meta') or {}).get('taskType'),
        },
    })


def _result_changed(
    current_status: dict[str, Any] | None,
    current_output: Any,
    previous_status: dict[str, Any] | None,
    previous_output: Any,
) -> bool:
    current_digest = str((current_status or {}).get('output_digest') or '').strip()
    previous_digest = str((previous_status or {}).get('output_digest') or '').strip()
    if current_digest and previous_digest:
        return current_digest != previous_digest
    if current_output is not None and previous_output is not None:
        return _digest(current_output, output=True) != _digest(previous_output, output=True)
    current_cache_key = str((current_status or {}).get('cache_key') or '').strip()
    previous_cache_key = str((previous_status or {}).get('cache_key') or '').strip()
    if current_cache_key and previous_cache_key:
        return current_cache_key != previous_cache_key
    return True


def _descendants(graph: dict[str, Any], seeds: set[str]) -> set[str]:
    children: dict[str, set[str]] = defaultdict(set)
    for edge in graph.get('edges') or []:
        source = str(edge.get('source') or '')
        target = str(edge.get('target') or '')
        if source and target:
            children[source].add(target)
    found: set[str] = set()
    queue = deque(seeds)
    while queue:
        node_id = queue.popleft()
        for child in children.get(node_id, set()):
            if child in found or child in seeds:
                continue
            found.add(child)
            queue.append(child)
    return found


def merge_successful_run_state(
    *,
    current_graph: dict[str, Any],
    current_artifacts: dict[str, Any] | None,
    current_statuses: dict[str, dict[str, Any]] | None,
    previous_graph: dict[str, Any] | None,
    previous_artifacts: dict[str, Any] | None,
    previous_statuses: dict[str, dict[str, Any]] | None,
    previous_run_id: int | None,
) -> tuple[dict[str, Any], dict[str, dict[str, Any]], dict[str, Any]]:
    """Merge unaffected node results while dropping stale downstream results."""
    current_artifacts = dict(current_artifacts or {})
    current_statuses = dict(current_statuses or {})
    previous_graph = previous_graph or {}
    previous_artifacts = previous_artifacts or {}
    previous_statuses = dict(previous_statuses or {})

    current_nodes = _nodes(current_graph)
    previous_nodes = _nodes(previous_graph)
    current_incoming = _incoming_edges(current_graph)
    previous_incoming = _incoming_edges(previous_graph)
    valid_node_ids = set(current_nodes)

    # A selected-node run may carry a status entry for every workflow node,
    # with untouched nodes left as ``queued``. Those entries are not executions
    # and must never replace/erase the previously persisted node state. Prefer
    # the executor's canonical plan, then fall back to terminal successful
    # statuses for compatibility with older run payloads.
    execution_plan = current_artifacts.get('execution_plan') or {}
    planned_node_ids = {
        str(node_id)
        for node_id in (execution_plan.get('order') or [])
        if str(node_id) in valid_node_ids
    }
    if planned_node_ids:
        executed = planned_node_ids
    else:
        executed = {
            node_id
            for node_id, item in current_statuses.items()
            if node_id in valid_node_ids
            and str((item or {}).get('status') or '') in {'succeeded', 'cached'}
        }

    current_outputs = dict(current_artifacts.get('node_outputs') or {})
    previous_outputs = dict(previous_artifacts.get('node_outputs') or {})

    changed: set[str] = set()
    for node_id in valid_node_ids:
        current_node_signature = _node_signature(
            node_id, current_graph, current_nodes, current_incoming,
        )
        previous_node_signature = _node_signature(
            node_id, previous_graph, previous_nodes, previous_incoming,
        )
        if previous_node_signature is None or current_node_signature != previous_node_signature:
            if node_id in executed or node_id in previous_statuses or node_id in previous_outputs:
                changed.add(node_id)
            continue
        if node_id not in executed:
            continue
        if _result_changed(
            current_statuses.get(node_id),
            current_outputs.get(node_id),
            previous_statuses.get(node_id),
            previous_outputs.get(node_id),
        ):
            changed.add(node_id)

    invalidated = (_descendants(current_graph, changed) | (changed - executed)) - executed
    retained = valid_node_ids - executed - invalidated

    merged_outputs = {
        node_id: output
        for node_id, output in previous_outputs.items()
        if node_id in retained
    }
    merged_outputs.update({
        node_id: output
        for node_id, output in current_outputs.items()
        if node_id in executed
    })

    merged_statuses = {
        node_id: status
        for node_id, status in previous_statuses.items()
        if node_id in retained
    }
    merged_statuses.update({
        node_id: status
        for node_id, status in current_statuses.items()
        if node_id in executed
    })

    state = {
        'base_run_id': previous_run_id,
        'executed_node_ids': sorted(executed),
        'retained_node_ids': sorted(retained & (set(previous_statuses) | set(previous_outputs))),
        'invalidated_node_ids': sorted(invalidated),
        'changed_node_ids': sorted(changed),
    }
    current_artifacts['node_outputs'] = merged_outputs
    current_artifacts['execution_state'] = state
    return current_artifacts, merged_statuses, state
