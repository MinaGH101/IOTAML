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


def advise_workflow(
    goal: str,
    *,
    pattern_id: str | None = None,
    limit_patterns: int = 1,
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
            _resolve_step(step)
            for step in (pattern.get("steps") or [])
            if isinstance(step, dict)
        ]

        selected_patterns.append(
            {
                "id": pattern.get("id"),
                "title": pattern.get("title"),
                "score": score,
                "steps": steps,
            }
        )

    return {
        "goal": goal,
        "matched": bool(selected_patterns),
        "readOnly": True,
        "patterns": selected_patterns,
    }
