"""Read-only application knowledge for the IOTA AI guide."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any


_GUIDE_PATH = Path(__file__).with_name("knowledge") / "app_guide.json"
_TOKEN_RE = re.compile(r"[\w\u0600-\u06FF]+", re.UNICODE)


def _tokens(value: str) -> set[str]:
    return {
        token.casefold()
        for token in _TOKEN_RE.findall(value or "")
        if len(token) > 1
    }


@lru_cache(maxsize=1)
def get_app_guide() -> dict[str, Any]:
    """Load the curated application guide once per backend process."""
    with _GUIDE_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if not isinstance(payload, dict) or not isinstance(payload.get("topics"), list):
        raise RuntimeError("Invalid IOTA assistant app guide.")

    return payload


def search_app_guide(
    query: str,
    *,
    limit: int = 5,
) -> dict[str, Any]:
    """Return the most relevant app-guide topics for a user question."""
    guide = get_app_guide()
    normalized = (query or "").strip().casefold()
    query_tokens = _tokens(normalized)

    scored: list[tuple[int, dict[str, Any]]] = []

    for topic in guide["topics"]:
        if not isinstance(topic, dict):
            continue

        title = str(topic.get("title") or "")
        summary = str(topic.get("summary") or "")
        keywords = [
            str(keyword)
            for keyword in (topic.get("keywords") or [])
        ]
        details = [
            str(detail)
            for detail in (topic.get("details") or [])
        ]

        searchable = " ".join(
            [str(topic.get("id") or ""), title, summary, *keywords, *details]
        ).casefold()
        searchable_tokens = _tokens(searchable)

        score = len(query_tokens & searchable_tokens) * 4

        if normalized and normalized in searchable:
            score += 12

        for keyword in keywords:
            normalized_keyword = keyword.casefold()
            if normalized_keyword and normalized_keyword in normalized:
                score += 8

        if score > 0:
            scored.append((score, topic))

    scored.sort(
        key=lambda item: (
            -item[0],
            str(item[1].get("title") or "").casefold(),
        )
    )

    selected = [topic for _, topic in scored[: max(1, min(limit, 8))]]

    return {
        "product": guide.get("product", "IOTA ML"),
        "purpose": guide.get("purpose", ""),
        "count": len(selected),
        "topics": selected,
    }
