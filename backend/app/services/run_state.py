from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

TERMINAL_STATUSES = frozenset({'succeeded', 'failed', 'cancelled', 'timed_out'})
ACTIVE_STATUSES = frozenset({'queued', 'running'})
VALID_STATUSES = frozenset({'queued', 'running', *TERMINAL_STATUSES})
NODE_TERMINAL_STATUSES = frozenset({'succeeded', 'failed', 'skipped', 'cancelled'})


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def log_entry(level: str, message: str, **context: Any) -> dict[str, Any]:
    return {
        'timestamp': utcnow().isoformat() + 'Z',
        'level': level,
        'message': message,
        'context': context,
    }


def append_log(existing: list[dict] | None, level: str, message: str, **context: Any) -> list[dict]:
    logs = list(existing or [])
    logs.append(log_entry(level, message, **context))
    return logs[-500:]


def initial_node_statuses(graph: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(node.get('id')): {
            'status': 'queued',
            'name': str((node.get('data') or {}).get('label') or node.get('id')),
            'started_at': None,
            'finished_at': None,
            'duration_ms': None,
            'error': None,
        }
        for node in (graph.get('nodes') or [])
        if node.get('id') is not None
    }


def progress_payload(graph: dict[str, Any], node_statuses: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    statuses = node_statuses or initial_node_statuses(graph)
    total = len(statuses)
    finished = sum(1 for item in statuses.values() if item.get('status') in NODE_TERMINAL_STATUSES)
    running = [node_id for node_id, item in statuses.items() if item.get('status') == 'running']
    return {
        'nodes_total': total,
        'nodes_finished': finished,
        'percent': round((finished / total) * 100, 2) if total else 100.0,
        'current_node_id': running[0] if running else None,
    }

class RunCancelledError(RuntimeError):
    pass
