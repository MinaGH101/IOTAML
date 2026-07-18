from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from app.nodes.registry import canonical_node_id, get_node_runner
from app.workflow.graph import node_registry_id

CACHE_FORMAT_VERSION = "iota-node-cache-v1"


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, float):
        if value != value:
            return "NaN"
        if value == float("inf"):
            return "Infinity"
        if value == float("-inf"):
            return "-Infinity"
        return value
    if isinstance(value, dict):
        return {str(key): _jsonable(value[key]) for key in sorted(value, key=lambda item: str(item))}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    if isinstance(value, Path):
        return str(value)
    return str(value)


def canonical_json(value: Any) -> str:
    return json.dumps(_jsonable(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def node_policy(node: dict[str, Any]) -> tuple[bool, str, str]:
    registry_id = canonical_node_id(node_registry_id(node))
    if registry_id.startswith("COMP:"):
        snapshot = (node.get("data") or {}).get("componentSnapshot") or {}
        return True, str(snapshot.get("graph_hash") or snapshot.get("version_id") or "0"), registry_id
    runner = get_node_runner(registry_id)
    cacheable = bool(runner and runner.cacheable and runner.implemented)
    version = str(runner.cache_version if runner else "0")
    if registry_id.startswith("UC-"):
        code = str(getattr(runner, "record", None).code if runner and getattr(runner, "record", None) else "")
        version = hashlib.sha256(code.encode("utf-8")).hexdigest()[:16] if code else version
        cacheable = False
    return cacheable, version, registry_id


def static_fingerprint(node: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    cacheable, node_version, registry_id = node_policy(node)
    data = node.get("data") or {}
    payload = {
        "format": CACHE_FORMAT_VERSION,
        "node_type": registry_id,
        "node_version": node_version,
        "params": data.get("params") or {},
        "pinned": data.get("pinned") or None,
        "component_snapshot_hash": (data.get("componentSnapshot") or {}).get("graph_hash"),
    }
    return sha256_json(payload), {
        "cacheable": cacheable,
        "node_type": registry_id,
        "node_version": node_version,
    }


def full_cache_key(
    *,
    static_key: str,
    resolved_params: dict[str, Any],
    upstream: list[dict[str, Any]],
    external_inputs: dict[str, Any],
    target_column: str | None,
    task_type: str,
) -> str:
    return sha256_json({
        "format": CACHE_FORMAT_VERSION,
        "static": static_key,
        "resolved_params": resolved_params,
        "upstream": sorted(upstream, key=lambda item: canonical_json(item)),
        "external_inputs": external_inputs,
        "target_column": target_column,
        "task_type": task_type,
    })
