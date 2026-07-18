from __future__ import annotations

from typing import Any

from .catalog import get_node_details, list_node_summaries


CATALOG_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "list_nodes",
        "description": (
            "Search the application's implemented node catalog. "
            "Use this before recommending or selecting workflow nodes."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": ["string", "null"],
                    "description": (
                        "Search text such as scaler, classification, CSV, "
                        "missing values, visualization, or random forest."
                    ),
                },
                "category": {
                    "type": ["string", "null"],
                    "description": "Exact node category when known.",
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 20,
                    "description": "Maximum number of nodes to return.",
                },
            },
            "required": ["query", "category", "limit"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "get_node_details",
        "description": (
            "Get the complete definition of one node, including its input "
            "ports, output ports, settings, defaults, and validation rules."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "node_id": {
                    "type": "string",
                    "description": "Canonical node ID returned by list_nodes.",
                },
            },
            "required": ["node_id"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]


def execute_catalog_tool(
    tool_name: str,
    arguments: dict[str, Any],
) -> dict[str, Any]:
    if tool_name == "list_nodes":
        limit = max(1, min(int(arguments.get("limit", 10)), 20))

        matches = list_node_summaries(
            query=arguments.get("query"),
            category=arguments.get("category"),
            implemented_only=True,
        )

        compact_matches = [
            {
                **node,
                "description": node.get("description", "")[:240],
            }
            for node in matches[:limit]
        ]

        return {
            "count": len(compact_matches),
            "totalMatches": len(matches),
            "truncated": len(matches) > limit,
            "nodes": compact_matches,
        }

    if tool_name == "get_node_details":
        node_id = str(arguments["node_id"]).strip()
        node = get_node_details(node_id)

        if node is None:
            return {
                "found": False,
                "nodeId": node_id,
                "error": "Unknown or unregistered node ID.",
            }

        return {
            "found": True,
            "node": node,
        }

    return {
        "error": f"Unsupported assistant tool: {tool_name}",
    }