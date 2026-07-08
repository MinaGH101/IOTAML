from __future__ import annotations

from typing import Any
from app.nodes.registry import all_nodes_api, get_categories, get_node, node_map


def get_node_registry() -> list[dict[str, Any]]:
    return all_nodes_api()


def get_node_map() -> dict[str, dict[str, Any]]:
    return {node_id: node.to_api() for node_id, node in node_map().items()}


def get_node_categories() -> list[str]:
    return get_categories()


def get_node_definition(node_id: str) -> dict[str, Any] | None:
    node = get_node(node_id)
    return node.to_api() if node else None
