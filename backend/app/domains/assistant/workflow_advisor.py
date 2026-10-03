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


def _model_performance_profile(name: str) -> dict[str, Any]:
    """Return relative latency guidance without inventing hardware timings."""
    normalized = name.casefold()
    profile: dict[str, Any] = {
        "trainingSpeed": "medium",
        "predictionSpeed": "fast",
        "scalingRecommended": False,
        "largeDatasetSuitability": "medium",
        "note": "Measure on the actual dataset before making a final choice.",
    }

    if "gaussian nb" in normalized or "naive bayes" in normalized:
        profile.update(
            trainingSpeed="very_fast",
            predictionSpeed="very_fast",
            largeDatasetSuitability="high",
            note="Very fast baseline, but its feature-distribution assumptions may reduce accuracy.",
        )
    elif "decision tree" in normalized:
        profile.update(
            trainingSpeed="very_fast",
            predictionSpeed="very_fast",
            largeDatasetSuitability="medium",
            note="Good fast and interpretable baseline; control depth to reduce overfitting.",
        )
    elif any(term in normalized for term in ["logistic regression", "linear svc", "linear regression", "ridge", "lasso", "elasticnet"]):
        profile.update(
            trainingSpeed="fast",
            predictionSpeed="very_fast",
            scalingRecommended=True,
            largeDatasetSuitability="high",
            note="Strong low-latency baseline; scaling is recommended for stable optimization.",
        )
    elif "hist gradient boosting" in normalized:
        profile.update(
            trainingSpeed="fast",
            predictionSpeed="fast",
            largeDatasetSuitability="high",
            note="Usually a strong balance of tabular-data accuracy and training time, especially on larger datasets.",
        )
    elif "extra trees" in normalized:
        profile.update(
            trainingSpeed="fast",
            predictionSpeed="medium",
            largeDatasetSuitability="high",
            note="Often faster to train than a random forest while retaining nonlinear modeling power.",
        )
    elif "random forest" in normalized:
        profile.update(
            trainingSpeed="medium",
            predictionSpeed="medium",
            largeDatasetSuitability="high",
            note="Reliable nonlinear baseline; more trees increase both training and prediction delay.",
        )
    elif "gradient boosting" in normalized:
        profile.update(
            trainingSpeed="slow",
            predictionSpeed="fast",
            largeDatasetSuitability="medium",
            note="Can be accurate, but sequential tree training is slower than histogram boosting.",
        )
    elif "knn" in normalized or "nearest" in normalized:
        profile.update(
            trainingSpeed="very_fast",
            predictionSpeed="slow",
            scalingRecommended=True,
            largeDatasetSuitability="low",
            note="Training is cheap, but prediction and memory cost grow with the dataset.",
        )
    elif "svc" in normalized:
        profile.update(
            trainingSpeed="slow",
            predictionSpeed="medium",
            scalingRecommended=True,
            largeDatasetSuitability="low",
            note="Useful for smaller datasets; nonlinear kernels can become slow as row count grows.",
        )

    return profile


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
    selected = candidates[:12] if is_choice_step else candidates[:1]

    if is_choice_step:
        selected = [
            {
                **candidate,
                "performance": _model_performance_profile(str(candidate.get("name") or "")),
            }
            for candidate in selected
        ]

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

    select_step = next(
        (step for step in steps if step.get("id") == "select_features_target"),
        None,
    )
    if pattern_id in {"classification", "regression"} and select_step and not select_step.get("alreadyPresent"):
        target_step = select_step
    else:
        target_step = next_missing
    target_step_id = str(target_step.get("id")) if target_step else ""
    target_choice = _first_node_choice(target_step) if target_step else None
    target_matches = target_step.get("matchedExistingNodes") if target_step else []
    target_name = ""
    if target_matches:
        target_name = str(target_matches[0].get("name") or "")
    elif target_choice:
        target_name = str(target_choice.get("name") or "")

    recommended = source_nodes[0]
    alternatives = source_nodes[1:4]

    return {
        "recommendedSourceNodeId": recommended.get("instanceId"),
        "recommendedSourceName": _display_name(recommended),
        "connectToStepId": target_step_id,
        "connectToNodeName": target_name,
        "persianInstruction": (
            f"ورودی نود `{target_name}` را به خروجی نود `{_display_name(recommended)}` وصل کنید."
            if target_name else ""
        ),
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


def _model_recommendation(
    pattern_id: str,
    steps: list[dict[str, Any]],
    current_workflow: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if pattern_id not in {"classification", "regression"}:
        return None

    model_step = next((step for step in steps if step.get("id") == "model"), None)
    candidates = model_step.get("nodes") if model_step else []
    if not candidates:
        return None

    dataset_profile = (current_workflow or {}).get("datasetProfile") or {}
    row_count = int(dataset_profile.get("rowCount") or 0)
    speed_score = {"very_fast": 5, "fast": 4, "medium": 2, "slow": 0}

    def score(candidate: dict[str, Any]) -> tuple[int, str]:
        profile = candidate.get("performance") or {}
        value = speed_score.get(str(profile.get("trainingSpeed")), 1)
        value += speed_score.get(str(profile.get("predictionSpeed")), 1)
        suitability = str(profile.get("largeDatasetSuitability") or "medium")
        if row_count >= 50_000:
            value += {"high": 5, "medium": 1, "low": -5}.get(suitability, 0)
        elif row_count and row_count <= 10_000:
            value += 2 if profile.get("trainingSpeed") == "very_fast" else 0
        name = str(candidate.get("name") or "")
        normalized = name.casefold()
        if "hist gradient boosting" in normalized and row_count >= 20_000:
            value += 4
        if any(term in normalized for term in ["logistic regression", "linear svc", "ridge", "linear regression"]):
            value += 2
        if "decision tree" in normalized:
            value += 1
        return value, name.casefold()

    ranked = sorted(
        (candidate for candidate in candidates if isinstance(candidate, dict)),
        key=lambda candidate: (-score(candidate)[0], score(candidate)[1]),
    )
    if not ranked:
        return None

    best = ranked[0]
    return {
        "basis": "relative_latency_estimate",
        "datasetRowCount": row_count or None,
        "datasetColumnCount": dataset_profile.get("columnCount"),
        "recommended": {
            "nodeId": best.get("id"),
            "nodeName": best.get("name"),
            "performance": best.get("performance"),
        },
        "alternatives": [
            {
                "nodeId": candidate.get("id"),
                "nodeName": candidate.get("name"),
                "performance": candidate.get("performance"),
            }
            for candidate in ranked[1:3]
        ],
        "timingNote": (
            "Use relative speed labels only. Do not promise exact seconds because "
            "hardware, row count, column count, and model settings change latency."
        ),
    }


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
            source_name = _display_name(current_source)
            target_name = str(choice.get("name") or "")
            plan["connect"].append(
                {
                    "sourceNodeId": current_source.get("instanceId"),
                    "sourceNodeName": source_name,
                    "targetStepId": step_id,
                    "targetNodeId": choice.get("id"),
                    "targetNodeName": target_name,
                    "persianInstruction": (
                        f"ورودی نود `{target_name}` را به خروجی نود `{source_name}` وصل کنید."
                    ),
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

    model_recommendation = _model_recommendation(
        pattern_id,
        steps,
        current_workflow,
    )
    if model_recommendation:
        plan["modelRecommendation"] = model_recommendation

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
