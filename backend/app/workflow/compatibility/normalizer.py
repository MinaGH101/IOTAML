"""Normalize every persisted workflow format into the canonical runtime graph."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.nodes.registry import LEGACY_NODE_ALIASES, canonical_node_id

LEGACY_PREFIXES = ('data_', 'transform_', 'analysis_', 'model_', 'feature_')
DEMO_DATASETS = {
    'data_demo': 'iris',
    'data_demo_iris': 'iris',
    'data_demo_wine': 'wine',
    'data_demo_breast_cancer': 'breast_cancer',
}
SCALER_METHODS = {
    'transform_standard_scaler': 'standard',
    'transform_minmax_scaler': 'minmax',
    'transform_robust_scaler': 'robust',
}


def is_legacy_graph(graph: dict[str, Any]) -> bool:
    """Return whether a graph contains an identifier handled by compatibility aliases."""
    for node in graph.get('nodes') or []:
        data = node.get('data') or {}
        identifier = str(data.get('registryId') or node.get('type') or '')
        if identifier in LEGACY_NODE_ALIASES or identifier.startswith(LEGACY_PREFIXES):
            return True
    return False


def normalize_graph(graph: dict[str, Any]) -> dict[str, Any]:
    """Return a defensive, idempotent canonical representation of a saved graph.

    Historical identifiers are preserved in ``data.originalRegistryId`` for
    debugging and cache lineage, while execution always uses the canonical ID.
    """
    raw = deepcopy(graph or {})
    nodes = raw.get('nodes')
    edges = raw.get('edges')
    raw['nodes'] = nodes if isinstance(nodes, list) else []
    raw['edges'] = edges if isinstance(edges, list) else []
    raw.setdefault('meta', {})
    raw['meta'] = dict(raw['meta']) if isinstance(raw['meta'], dict) else {}
    raw['meta']['runtimeGraphVersion'] = 1

    for node in raw['nodes']:
        if not isinstance(node, dict):
            continue
        data = node.get('data')
        data = dict(data) if isinstance(data, dict) else {}
        original = str(data.get('originalRegistryId') or data.get('registryId') or node.get('type') or '')
        canonical = canonical_node_id(original)
        if original and original != canonical:
            data.setdefault('originalRegistryId', original)
        data['registryId'] = canonical
        node['type'] = canonical

        params = data.get('params')
        params = dict(params) if isinstance(params, dict) else {}
        if original in DEMO_DATASETS:
            data['compatibilityDataset'] = DEMO_DATASETS[original]
        if original in SCALER_METHODS:
            params.setdefault('method', SCALER_METHODS[original])
        data['params'] = params
        node['data'] = data

    for index, edge in enumerate(raw['edges']):
        if not isinstance(edge, dict):
            continue
        edge.setdefault('id', f"compat-edge-{index}-{edge.get('source', '')}-{edge.get('target', '')}")
    return raw
