from __future__ import annotations

from typing import Any

from app.core.request_context import get_request_id


def success_payload(data: Any = None, *, meta: dict[str, Any] | None = None, request_id: str | None = None) -> dict[str, Any]:
    return {
        "success": True,
        "data": data,
        "meta": meta or {},
        "request_id": request_id or get_request_id(),
    }


def error_payload(
    *,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
    request_id: str | None = None,
) -> dict[str, Any]:
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        },
        "request_id": request_id or get_request_id(),
    }
