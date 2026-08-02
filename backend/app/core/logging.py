"""Structured, bounded, context-aware application logging."""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.request_context import get_context

_SECRET_TOKENS = ('password', 'secret', 'token', 'authorization', 'api_key', 'access_key', 'cookie')


def _redact(value: Any, *, key: str = '') -> Any:
    settings = get_settings()
    if any(token in key.lower() for token in _SECRET_TOKENS):
        return '[REDACTED]'
    if isinstance(value, dict):
        return {str(child_key): _redact(child, key=str(child_key)) for child_key, child in value.items()}
    if isinstance(value, (list, tuple)):
        return [_redact(child) for child in value[:100]]
    text = str(value)
    return text if len(text) <= settings.log_field_max_length else text[: settings.log_field_max_length] + '…'


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': _redact(record.getMessage()),
            **get_context(),
        }
        for key in ('user', 'project_id', 'workflow_id', 'workflow_revision', 'run_id', 'run_attempt', 'node_id', 'node_type', 'worker_id', 'artifact_id', 'duration_ms', 'status_code'):
            if hasattr(record, key):
                payload[key] = _redact(getattr(record, key), key=key)
        if record.exc_info:
            payload['exception'] = _redact(self.formatException(record.exc_info), key='exception')
        return json.dumps(payload, ensure_ascii=False, separators=(',', ':'))


def configure_logging() -> None:
    settings = get_settings()
    root = logging.getLogger()
    root.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if settings.log_json else logging.Formatter('%(asctime)s %(levelname)s %(name)s %(message)s'))
    root.addHandler(handler)
    root.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
