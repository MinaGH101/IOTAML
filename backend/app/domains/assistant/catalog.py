from __future__ import annotations

from typing import Any

from app.nodes.registry import (
    all_nodes_api,
    canonical_node_id,
    catalog_metadata,
    get_node,
)


def get_full_catalog() -> dict[str, Any]:
    """Return the live node catalog from the backend registry.

    This is the source the AI agent should query. It prevents catalog drift when
    nodes or settings are added, removed, or changed.
    """
    metadata = catalog_metadata()
    nodes = all_nodes_api()
    return {
        "catalogVersion": metadata["version"],
        "nodeCount": len(nodes),
        "categories": metadata["categories"],
        "aliases": metadata["aliases"],
        "compatiblePorts": metadata["compatiblePorts"],
        "nodes": nodes,
    }


def list_node_summaries(
    *,
    category: str | None = None,
    query: str | None = None,
    implemented_only: bool = True,
) -> list[dict[str, Any]]:
    """Return compact node summaries suitable for an AI tool response."""
    normalized_query = (query or "").strip().casefold()
    summaries: list[dict[str, Any]] = []

    for node in all_nodes_api():
        if implemented_only and not node.get("implemented", False):
            continue
        if category and node.get("category") != category:
            continue

        searchable = " ".join(
            str(node.get(key, ""))
            for key in ("id", "name", "category", "description")
        ).casefold()
        if normalized_query and normalized_query not in searchable:
            continue

        summaries.append(
            {
                "id": node["id"],
                "name": node["name"],
                "category": node["category"],
                "description": node.get("description", ""),
                "inputTypes": [port["type"] for port in node.get("inputs", [])],
                "outputTypes": [port["type"] for port in node.get("outputs", [])],
            }
        )

    return summaries


def get_node_details(node_id: str) -> dict[str, Any] | None:
    """Return one canonical node definition with ports and settings."""
    definition = get_node(canonical_node_id(node_id))
    return definition.to_api() if definition else None
