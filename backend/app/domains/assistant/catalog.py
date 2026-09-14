"""Assistant domain catalog for the IOTA ML backend."""

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
    """Return ranked compact node summaries for assistant retrieval.

    Search is token-aware instead of requiring the user's complete phrase to
    exist verbatim in a node definition. This keeps natural questions such as
    "remove missing data" grounded in the real catalog even when the actual
    node is named "Imputation".
    """
    normalized_query = (query or "").strip().casefold()
    query_tokens = {
        token
        for token in normalized_query.replace("/", " ").replace("-", " ").split()
        if len(token) > 1
    }
    ranked: list[tuple[int, dict[str, Any]]] = []

    for node in all_nodes_api():
        if implemented_only and not node.get("implemented", False):
            continue
        if category and node.get("category") != category:
            continue

        name = str(node.get("name", ""))
        node_category = str(node.get("category", ""))
        description = str(node.get("description", ""))
        searchable = " ".join(
            [str(node.get("id", "")), name, node_category, description]
        ).casefold()

        if normalized_query:
            score = 0
            if normalized_query in searchable:
                score += 100
            if normalized_query == name.casefold():
                score += 200

            matched_tokens = sum(1 for token in query_tokens if token in searchable)
            if matched_tokens == 0:
                continue

            score += matched_tokens * 12
            if query_tokens and matched_tokens == len(query_tokens):
                score += 30
            score += sum(10 for token in query_tokens if token in name.casefold())
        else:
            score = 1

        summary = {
            "id": node["id"],
            "name": name,
            "category": node_category,
            "description": description,
            "inputTypes": [port["type"] for port in node.get("inputs", [])],
            "outputTypes": [port["type"] for port in node.get("outputs", [])],
        }
        ranked.append((score, summary))

    ranked.sort(key=lambda item: (-item[0], item[1]["name"].casefold()))
    return [summary for _, summary in ranked]


def get_node_details(node_id: str) -> dict[str, Any] | None:
    """Return one canonical node definition with ports and settings."""
    definition = get_node(canonical_node_id(node_id))
    return definition.to_api() if definition else None
