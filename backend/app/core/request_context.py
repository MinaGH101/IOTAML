"""Context variables propagated through API and worker logs."""

from __future__ import annotations

from contextvars import ContextVar, Token
from typing import Any

_context: ContextVar[dict[str, Any]] = ContextVar('request_context', default={})


def set_request_id(value: str) -> None:
    current = dict(_context.get())
    current['request_id'] = value
    _context.set(current)


def get_request_id() -> str:
    return str(_context.get().get('request_id') or '')


def bind_context(**values: Any) -> Token:
    current = dict(_context.get())
    current.update({key: value for key, value in values.items() if value is not None})
    return _context.set(current)


def reset_context(token: Token) -> None:
    _context.reset(token)


def get_context() -> dict[str, Any]:
    return dict(_context.get())
