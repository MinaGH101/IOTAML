"""Assistant domain tools for the IOTA ML backend."""

from __future__ import annotations

from typing import Any

from .app_guide import search_app_guide
from .catalog import get_node_details, list_node_summaries
from .workflow_advisor import advise_workflow


APP_GUIDE_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "search_app_guide",
        "description": (
            "Search the curated IOTA ML application guide. Use this for questions "
            "about app pages, projects, datasets, workflows, workspace behavior, "
            "results, boards, versions, components, and how to use the application."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The user's app-usage question or topic to search for.",
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 8,
                    "description": "Maximum number of guide topics to return.",
                },
            },
            "required": ["query", "limit"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]


WORKFLOW_ADVISOR_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "advise_workflow",
        "description": (
            "Build a read-only IOTA workflow recommendation for a user's goal. "
            "Use this when the user asks what nodes to use, what order to use them "
            "in, or how to accomplish an analysis or ML task. The returned node "
            "names are resolved from the live implemented node catalog."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "goal": {
                    "type": "string",
                    "description": (
                        "The user's goal in natural language, for example training "
                        "a classification model, visualizing data, handling missing "
                        "values, or analyzing correlations."
                    ),
                },
                "pattern_id": {
                    "type": ["string", "null"],
                    "description": (
                        "Optional exact curated pattern ID when already known. "
                        "Otherwise pass null."
                    ),
                },
            },
            "required": ["goal", "pattern_id"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]


def execute_workflow_advisor_tool(
    tool_name: str,
    arguments: dict[str, Any],
) -> dict[str, Any]:
    if tool_name != "advise_workflow":
        return {"error": f"Unsupported workflow-advisor tool: {tool_name}"}

    goal = str(arguments.get("goal") or "").strip()
    pattern_id_raw = arguments.get("pattern_id")
    pattern_id = (
        str(pattern_id_raw).strip()
        if pattern_id_raw is not None and str(pattern_id_raw).strip()
        else None
    )

    if not goal:
        return {
            "matched": False,
            "patterns": [],
            "error": "A workflow goal is required.",
        }

    return advise_workflow(goal, pattern_id=pattern_id)


CATALOG_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "list_nodes",
        "description": (
            "Search the application's implemented node catalog. "
            "Use this before recommending, naming, or selecting workflow nodes. "
            "The returned `name` is the exact user-visible node name shown in the "
            "IOTA Node Palette and must be copied verbatim in user guidance."
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
            "Get the complete definition of one node, including its exact "
            "user-visible name, input ports, output ports, settings, defaults, "
            "and validation rules."
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


def execute_app_guide_tool(
    tool_name: str,
    arguments: dict[str, Any],
) -> dict[str, Any]:
    if tool_name != "search_app_guide":
        return {"error": f"Unsupported app-guide tool: {tool_name}"}

    query = str(arguments.get("query") or "").strip()
    limit = max(1, min(int(arguments.get("limit", 5)), 8))

    if not query:
        return {
            "count": 0,
            "topics": [],
            "error": "A guide search query is required.",
        }

    return search_app_guide(query, limit=limit)


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
