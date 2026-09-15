"""Read-only workflow recommendation engine for the IOTA AI assistant.

This module does not create, modify, connect, save, or execute workflow nodes.
It maps a user's goal to curated logical steps, then resolves every suggested
node against the live IOTA node registry.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.domains.assistant.catalog import list_node_summaries
from app.nodes.registry import canonical_node_id


_PATTERNS_PATH = Path(__file__).with_name("knowledge") / "workflow_patterns.json"
_TOKEN_RE = re.compile(r"[\w\u0600-\u06FF]+", re.UNICODE)


def _tokens(value: str) -> set[str]:
    return {
        token.casefold()
        for token in _TOKEN_RE.findall(value or "")
        if len(token) > 1
    }


@lru_cache(maxsize=1)
def get_workflow_patterns() -> dict[str, Any]:
    """Load curated workflow patterns once per backend process."""
    with _PATTERNS_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if not isinstance(payload, dict) or not isinstance(payload.get("patterns"), list):
        raise RuntimeError("Invalid IOTA workflow advisor patterns.")

    return payload


def _pattern_score(pattern: dict[str, Any], query: str) -> int:
    normalized = (query or "").strip().casefold()
    query_tokens = _tokens(normalized)

    title = str(pattern.get("title") or "")
    keywords = [str(item) for item in (pattern.get("keywords") or [])]
    searchable = " ".join(
        [str(pattern.get("id") or ""), title, *keywords]
    ).casefold()

    searchable_tokens = _tokens(searchable)
    score = len(query_tokens & searchable_tokens) * 4

    for keyword in keywords:
        keyword_normalized = keyword.casefold()
        if keyword_normalized and keyword_normalized in normalized:
            score += 18

    if normalized and normalized in searchable:
        score += 12

    return score


def _resolve_step(step: dict[str, Any]) -> dict[str, Any]:
    """Resolve one logical step to real implemented catalog nodes."""
    query = str(step.get("catalog_query") or "").strip()
    category = step.get("category")

    candidates = list_node_summaries(
        category=str(category) if category else None,
        query=query or None,
        implemented_only=True,
    )

    # Generic model/visualization/detector steps intentionally expose several
    # live choices. Normal steps return the best matching node only.
    is_choice_step = bool(step.get("selection"))
    selected = candidates[:8] if is_choice_step else candidates[:1]

    return {
        "id": step.get("id"),
        "purpose": step.get("purpose", ""),
        "required": bool(step.get("required", False)),
        "condition": step.get("condition"),
        "selection": step.get("selection"),
        "nodes": selected,
        "resolved": bool(selected),
    }


def _display_name(node: dict[str, Any]) -> str:
    return str(
        node.get("label")
        or node.get("typeLabel")
        or node.get("name")
        or ""
    ).strip()


def _annotate_step_with_workflow(
    step: dict[str, Any],
    current_workflow: dict[str, Any] | None,
) -> dict[str, Any]:
    if not current_workflow:
        return step

    candidate_names = {
        str(node.get("name") or "").strip()
        for node in step.get("nodes", [])
        if str(node.get("name") or "").strip()
    }
    candidate_ids = {
        canonical_node_id(str(node.get("id") or "").strip())
        for node in step.get("nodes", [])
        if str(node.get("id") or "").strip()
    }

    matches = []
    for existing in current_workflow.get("nodes", []):
        existing_id = canonical_node_id(str(existing.get("registryId") or ""))
        existing_names = {
            str(existing.get("label") or "").strip(),
            str(existing.get("typeLabel") or "").strip(),
        }

        if existing_id in candidate_ids or candidate_names.intersection(existing_names):
            matches.append(
                {
                    "instanceId": existing.get("instanceId"),
                    "name": _display_name(existing),
                    "registryId": existing.get("registryId"),
                }
            )

    return {
        **step,
        "alreadyPresent": bool(matches),
        "matchedExistingNodes": matches,
    }


def _connection_advice(
    pattern_id: str,
    steps: list[dict[str, Any]],
    current_workflow: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not current_workflow:
        return None

    summary = current_workflow.get("summary") or {}
    node_by_id = {
        str(node.get("instanceId") or ""): node
        for node in current_workflow.get("nodes", [])
    }

    source_ids = (
        summary.get("preferredDataframeSourceNodeIds")
        or summary.get("dataframeEndpointNodeIds")
        or summary.get("dataframeNodeIds")
        or []
    )
    source_nodes = [
        node_by_id[node_id]
        for node_id in source_ids
        if node_id in node_by_id
    ]

    if not source_nodes:
        return None

    next_missing = next(
        (
            step for step in steps
            if step.get("required") and not step.get("alreadyPresent")
        ),
        None,
    )

    if pattern_id in {"classification", "regression"}:
        target_step_id = "select_features_target"
    else:
        target_step_id = str(next_missing.get("id")) if next_missing else ""

    recommended = source_nodes[0]
    alternatives = source_nodes[1:4]

    return {
        "recommendedSourceNodeId": recommended.get("instanceId"),
        "recommendedSourceName": _display_name(recommended),
        "connectToStepId": target_step_id,
        "reason": (
            "Prefer connecting new downstream nodes to the latest useful "
            "dataframe-producing node, especially after cleaning, selection, "
            "detection-limit handling, imputation, or normalization."
        ),
        "alternativeSourceNodes": [
            {
                "instanceId": node.get("instanceId"),
                "name": _display_name(node),
            }
            for node in alternatives
        ],
    }


def _first_node_choice(step: dict[str, Any]) -> dict[str, Any] | None:
    nodes = step.get("nodes") or []
    if not nodes:
        return None
    first = nodes[0]
    return first if isinstance(first, dict) else None


def _action_plan(
    pattern_id: str,
    steps: list[dict[str, Any]],
    current_workflow: dict[str, Any] | None,
) -> dict[str, Any]:
    """Build a dry-run plan that future write tools can map to actions."""
    plan: dict[str, Any] = {
        "mode": "dry_run",
        "patternId": pattern_id,
        "alreadyPresent": [],
        "add": [],
        "connect": [],
        "configure": [],
        "notes": [],
    }

    current_source: dict[str, Any] | None = None
    source_rewind_step_ids = {"load_data", "inspect_data", "missing_values"}
    if current_workflow:
        summary = current_workflow.get("summary") or {}
        node_by_id = {
            str(node.get("instanceId") or ""): node
            for node in current_workflow.get("nodes", [])
        }
        source_ids = (
            summary.get("preferredDataframeSourceNodeIds")
            or summary.get("dataframeEndpointNodeIds")
            or summary.get("dataframeNodeIds")
            or []
        )
        for source_id in source_ids:
            if source_id in node_by_id:
                current_source = node_by_id[source_id]
                break

    for step in steps:
        step_id = str(step.get("id") or "")
        matches = step.get("matchedExistingNodes") or []
        if step.get("alreadyPresent") and matches:
            first_match = matches[0]
            plan["alreadyPresent"].append(
                {
                    "stepId": step_id,
                    "instanceId": first_match.get("instanceId"),
                    "nodeName": first_match.get("name"),
                    "registryId": first_match.get("registryId"),
                }
            )
            if current_source is None or step_id not in source_rewind_step_ids:
                current_source = {
                    "instanceId": first_match.get("instanceId"),
                    "label": first_match.get("name"),
                    "typeLabel": first_match.get("name"),
                }
            continue

        if not step.get("required"):
            choice = _first_node_choice(step)
            if choice and step.get("condition"):
                plan["notes"].append(
                    {
                        "stepId": step_id,
                        "nodeId": choice.get("id"),
                        "nodeName": choice.get("name"),
                        "condition": step.get("condition"),
                    }
                )
            continue

        choice = _first_node_choice(step)
        if not choice:
            plan["notes"].append(
                {
                    "stepId": step_id,
                    "warning": "No implemented node resolved for this required step.",
                }
            )
            continue

        add_action = {
            "stepId": step_id,
            "nodeId": choice.get("id"),
            "nodeName": choice.get("name"),
            "purpose": step.get("purpose"),
            "requiresChoice": bool(step.get("selection")),
        }
        if step.get("selection"):
            add_action["choices"] = [
                {
                    "nodeId": node.get("id"),
                    "nodeName": node.get("name"),
                    "description": node.get("description"),
                }
                for node in step.get("nodes", [])
                if isinstance(node, dict)
            ]
        plan["add"].append(add_action)

        if current_source:
            plan["connect"].append(
                {
                    "sourceNodeId": current_source.get("instanceId"),
                    "sourceNodeName": _display_name(current_source),
                    "targetStepId": step_id,
                    "targetNodeId": choice.get("id"),
                    "targetNodeName": choice.get("name"),
                    "reason": (
                        "Connect the next missing step to the latest relevant "
                        "upstream node that already prepares or produces the "
                        "data needed for this goal."
                    ),
                }
            )

        current_source = {
            "instanceId": f"new:{step_id}",
            "label": choice.get("name"),
            "typeLabel": choice.get("name"),
        }

    if pattern_id in {"classification", "regression"}:
        plan["configure"].append(
            {
                "stepId": "select_features_target",
                "instruction": (
                    "Choose the target column first, then select feature columns "
                    "that are available after the recommended upstream cleaning "
                    "or preprocessing node."
                ),
            }
        )

    return plan


def advise_workflow(
    goal: str,
    *,
    pattern_id: str | None = None,
    limit_patterns: int = 1,
    current_workflow: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Recommend a read-only workflow plan grounded in the live node catalog.

    When ``pattern_id`` is provided, that exact curated pattern is used.
    Otherwise patterns are ranked from the user's natural-language goal.
    """
    payload = get_workflow_patterns()
    patterns = [
        pattern
        for pattern in payload["patterns"]
        if isinstance(pattern, dict)
    ]

    if pattern_id:
        matches = [
            pattern
            for pattern in patterns
            if str(pattern.get("id") or "") == pattern_id
        ]
        if not matches:
            return {
                "goal": goal,
                "matched": False,
                "reason": f"Unknown workflow pattern: {pattern_id}",
                "patterns": [],
            }
        ranked = [(1000, matches[0])]
    else:
        ranked = [
            (_pattern_score(pattern, goal), pattern)
            for pattern in patterns
        ]
        ranked = [item for item in ranked if item[0] > 0]
        ranked.sort(
            key=lambda item: (
                -item[0],
                str(item[1].get("title") or "").casefold(),
            )
        )

    selected_patterns: list[dict[str, Any]] = []
    for score, pattern in ranked[: max(1, min(limit_patterns, 5))]:
        steps = [
            _annotate_step_with_workflow(
                _resolve_step(step),
                current_workflow,
            )
            for step in (pattern.get("steps") or [])
            if isinstance(step, dict)
        ]

        selected_patterns.append(
            {
                "id": pattern.get("id"),
                "title": pattern.get("title"),
                "score": score,
                "steps": steps,
                "connectionAdvice": _connection_advice(
                    str(pattern.get("id") or ""),
                    steps,
                    current_workflow,
                ),
                "actionPlan": _action_plan(
                    str(pattern.get("id") or ""),
                    steps,
                    current_workflow,
                ),
            }
        )

    return {
        "goal": goal,
        "matched": bool(selected_patterns),
        "readOnly": True,
        "patterns": selected_patterns,
    }
