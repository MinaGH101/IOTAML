from __future__ import annotations

import copy
import hashlib
from typing import Any, Callable

import joblib

from app.nodes.io import node_label
from app.services.run_state import RunCancelledError
from app.workflow.expressions import resolve_settings
from app.workflow.graph import topological_sort, upstream_outputs


def is_component_node(node: dict[str, Any]) -> bool:
    data = node.get("data") or {}
    return str(data.get("registryId") or "").startswith("COMP:") and isinstance(data.get("componentSnapshot"), dict)


def component_snapshot(node: dict[str, Any]) -> dict[str, Any]:
    snapshot = (node.get("data") or {}).get("componentSnapshot")
    if not isinstance(snapshot, dict):
        raise ValueError("Component snapshot is missing. Reinsert or upgrade this component from the component library.")
    if not isinstance(snapshot.get("graph"), dict) or not isinstance(snapshot.get("interface"), dict):
        raise ValueError("Component snapshot is invalid.")
    return snapshot


def component_ports(node: dict[str, Any], side: str) -> list[dict[str, Any]]:
    snapshot = component_snapshot(node)
    return list((snapshot.get("interface") or {}).get(side) or [])


def component_settings(node: dict[str, Any]) -> list[dict[str, Any]]:
    return list(component_snapshot(node).get("exposed_parameters") or [])


def _digest(value: Any) -> str:
    try:
        return str(joblib.hash(value, hash_name="sha1"))
    except Exception:
        return hashlib.sha256(repr(value).encode("utf-8", errors="replace")).hexdigest()


def _namespace_graph(graph: dict[str, Any], prefix: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, str]]:
    mapping = {str(node.get("id")): f"{prefix}::{node.get('id')}" for node in graph.get("nodes") or []}
    nodes = []
    for original in graph.get("nodes") or []:
        node = copy.deepcopy(original)
        original_id = str(node.get("id"))
        node["id"] = mapping[original_id]
        data = dict(node.get("data") or {})
        data["componentInternalId"] = original_id
        data["componentPath"] = prefix
        node["data"] = data
        nodes.append(node)
    edges = []
    for original in graph.get("edges") or []:
        edge = copy.deepcopy(original)
        edge["id"] = f"{prefix}::{edge.get('id') or len(edges)}"
        edge["source"] = mapping[str(edge.get("source"))]
        edge["target"] = mapping[str(edge.get("target"))]
        edges.append(edge)
    return nodes, edges, mapping


def execute_component(
    node: dict[str, Any],
    inputs: dict[str, Any],
    ctx: Any,
    resolved_component_params: dict[str, Any],
    *,
    apply_node: Callable[..., dict[str, Any]],
    runtime_cache: Any = None,
    progress_callback: Callable[..., None] | None = None,
    cancel_check: Callable[[], bool] | None = None,
) -> dict[str, Any]:
    snapshot = component_snapshot(node)
    parent_id = str(node.get("id"))
    if parent_id.count("::") >= 12:
        raise ValueError("Component nesting exceeds the supported depth of 12 levels.")
    nodes, edges, mapping = _namespace_graph(snapshot["graph"], parent_id)
    by_id = {str(item["id"]): item for item in nodes}

    # Exposed parameters are copied into internal node settings. The immutable
    # component snapshot remains unchanged, which keeps cache keys deterministic.
    for exposed in snapshot.get("exposed_parameters") or []:
        exposed_id = str(exposed.get("id"))
        internal_id = mapping.get(str(exposed.get("internal_node_id")))
        if not internal_id or internal_id not in by_id:
            continue
        value = resolved_component_params.get(exposed_id, exposed.get("default"))
        data = dict(by_id[internal_id].get("data") or {})
        params = dict(data.get("params") or {})
        params[str(exposed.get("internal_param"))] = value
        data["params"] = params
        by_id[internal_id]["data"] = data

    injected: dict[str, dict[str, list[Any]]] = {}
    external_refs: dict[str, list[dict[str, Any]]] = {}
    by_port = inputs.get("_by_port") or {}
    for port in (snapshot.get("interface") or {}).get("inputs") or []:
        internal_id = mapping.get(str(port.get("internal_node_id")))
        if not internal_id:
            continue
        handle = str(port.get("internal_handle") or "input")
        values = list(by_port.get(str(port.get("id"))) or [])
        if not values and port.get("required"):
            raise ValueError(f"Component input '{port.get('name') or port.get('id')}' is required.")
        injected.setdefault(internal_id, {}).setdefault(handle, []).extend(values)
        for value in values:
            external_refs.setdefault(internal_id, []).append({
                "node_id": f"{parent_id}:input:{port.get('id')}",
                "digest": _digest(value),
                "source_handle": str(port.get("id")),
                "target_handle": handle,
                "input_name": handle,
            })

    order = topological_sort(nodes, edges)
    outputs: dict[str, Any] = {}
    for internal_id in order:
        if cancel_check and cancel_check():
            raise RunCancelledError("Cancellation requested.")
        internal_node = by_id[internal_id]
        if progress_callback:
            progress_callback(internal_id, "running", None, {"component_parent_id": parent_id})
        internal_inputs = upstream_outputs(internal_id, edges, outputs)
        for handle, values in injected.get(internal_id, {}).items():
            internal_inputs.setdefault("_by_port", {}).setdefault(handle, []).extend(values)
            for index, value in enumerate(values):
                internal_inputs[f"__component_input_{handle}_{index}"] = value
        params = resolve_settings((internal_node.get("data") or {}).get("params") or {}, ctx.expression_context())
        parent_refs = (runtime_cache.parent_refs(internal_id, edges) if runtime_cache else []) + external_refs.get(internal_id, [])
        cached = None
        cache_meta: dict[str, Any] = {}
        if runtime_cache:
            cached, cache_meta = runtime_cache.lookup(internal_node, params, parent_refs)
        if cached is not None:
            result = cached
            if progress_callback:
                progress_callback(internal_id, "cached", None, {**cache_meta, "component_parent_id": parent_id})
        else:
            result = apply_node(
                internal_node, internal_inputs, ctx, params,
                runtime_cache=runtime_cache, progress_callback=progress_callback, cancel_check=cancel_check,
            )
            record = runtime_cache.store(internal_node, result, params, parent_refs, {}) if runtime_cache else None
            if progress_callback:
                progress_callback(internal_id, "succeeded", None, {**(record or {}), "component_parent_id": parent_id})
        outputs[internal_id] = result
        ctx.node_outputs[internal_id] = result

    output_ports: dict[str, Any] = {}
    for port in (snapshot.get("interface") or {}).get("outputs") or []:
        source_id = mapping.get(str(port.get("internal_node_id")))
        if not source_id or source_id not in outputs:
            if port.get("required"):
                raise ValueError(f"Component output '{port.get('name') or port.get('id')}' was not produced.")
            continue
        from app.workflow.graph import output_for_handle
        output_ports[str(port.get("id"))] = output_for_handle(outputs[source_id], str(port.get("internal_handle") or "output"))

    default_value = next(iter(output_ports.values()), None)
    return {
        "output": default_value,
        "outputs_by_port": output_ports,
        "component": {
            "component_id": snapshot.get("component_id"),
            "version_id": snapshot.get("version_id"),
            "semantic_version": snapshot.get("semantic_version"),
            "graph_hash": snapshot.get("graph_hash"),
            "label": node_label(node),
        },
    }
