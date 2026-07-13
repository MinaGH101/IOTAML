from __future__ import annotations

import json
import os
import socket
import sys
import time
import traceback
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pandas as pd

from app.services.run_state import RunCancelledError, initial_node_statuses, progress_payload


def _atomic_write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding='utf-8')
    temporary.replace(path)


def _disable_network() -> None:
    def blocked(*_args, **_kwargs):
        raise PermissionError('Network access is disabled inside workflow execution.')

    socket.create_connection = blocked  # type: ignore[assignment]
    original_socket = socket.socket

    class RestrictedSocket(original_socket):
        def connect(self, *_args, **_kwargs):
            return blocked()

        def connect_ex(self, *_args, **_kwargs):
            blocked()
            return 1

    socket.socket = RestrictedSocket  # type: ignore[assignment]


def _sanitize_environment(work_dir: Path) -> None:
    allowed = {'PATH', 'PYTHONPATH', 'LANG', 'LC_ALL', 'TZ', 'STORAGE_DIR', 'JOB_NETWORK_DISABLED', 'IOTA_CUSTOM_NODE_SNAPSHOT'}
    for key in list(os.environ):
        if key not in allowed:
            os.environ.pop(key, None)
    os.environ['HOME'] = str(work_dir)
    os.environ['TMPDIR'] = str(work_dir / 'tmp')
    os.environ['PYTHONNOUSERSITE'] = '1'
    os.environ['PYTHONDONTWRITEBYTECODE'] = '1'
    Path(os.environ['TMPDIR']).mkdir(parents=True, exist_ok=True)


def _load_dataset(path: str | None) -> pd.DataFrame | None:
    if not path:
        return None
    dataset_path = Path(path)
    suffix = dataset_path.suffix.lower()
    if suffix in {'.xlsx', '.xls'}:
        return pd.read_excel(dataset_path)
    if suffix == '.tsv':
        return pd.read_csv(dataset_path, sep='\t')
    return pd.read_csv(dataset_path)


def execute(snapshot_path: Path, result_path: Path, progress_path: Path, cancel_path: Path) -> int:
    snapshot = json.loads(snapshot_path.read_text(encoding='utf-8'))
    graph = snapshot.get('workflow_graph') or {}
    statuses = initial_node_statuses(graph)
    started_monotonic: dict[str, float] = {}

    def save_progress() -> None:
        _atomic_write(progress_path, {
            'node_statuses': statuses,
            'progress': progress_payload(graph, statuses),
            'updated_at': time.time(),
        })

    def progress_callback(node_id: str, status: str, error: str | None) -> None:
        now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        item = statuses.setdefault(node_id, {'status': 'queued', 'name': node_id})
        if status == 'running' and not item.get('started_at'):
            item['started_at'] = now_iso
            started_monotonic[node_id] = time.monotonic()
        item['status'] = status
        if status in {'succeeded', 'failed', 'cancelled', 'skipped'}:
            item['finished_at'] = now_iso
            if node_id in started_monotonic:
                item['duration_ms'] = round((time.monotonic() - started_monotonic[node_id]) * 1000)
        item['error'] = error
        save_progress()

    def cancel_check() -> bool:
        return cancel_path.exists()

    work_dir = snapshot_path.parent
    _sanitize_environment(work_dir)
    if bool(snapshot.get('network_disabled', True)):
        _disable_network()
    os.chdir(work_dir)
    save_progress()

    try:
        from app.workflow.executor import execute_scientific_workflow, is_legacy_graph
        if is_legacy_graph(graph):
            from app.services.workflow_executor import execute_workflow as execute_legacy_workflow
            result = execute_legacy_workflow(
                graph,
                _load_dataset(snapshot.get('dataset_path')),
                snapshot.get('target_column'),
                snapshot.get('task_type') or 'auto',
                Path(snapshot.get('run_path') or work_dir / 'artifacts'),
                progress_callback=progress_callback,
                cancel_check=cancel_check,
            )
            normalized = {
                'metrics': {
                    'branches': len(result.get('branches') or []),
                    'errors': len(result.get('errors') or []),
                    'status': 'failed' if result.get('errors') else 'success',
                },
                'artifacts': result,
                'error': (result.get('errors') or [{}])[0].get('error') if result.get('errors') else None,
            }
        else:
            normalized = execute_scientific_workflow(
                graph,
                snapshot.get('dataset_id'),
                snapshot.get('target_column'),
                snapshot.get('task_type') or 'auto',
                snapshot.get('project_id'),
                snapshot.get('run_id'),
                dataset_path=snapshot.get('dataset_path'),
                progress_callback=progress_callback,
                cancel_check=cancel_check,
            )
        if cancel_check():
            raise RunCancelledError('Cancellation requested.')
        status = 'failed' if normalized.get('error') else 'succeeded'
        _atomic_write(result_path, {'status': status, **normalized})
        return 1 if status == 'failed' else 0
    except RunCancelledError as exc:
        _atomic_write(result_path, {'status': 'cancelled', 'error': str(exc), 'metrics': None, 'artifacts': None})
        return 2
    except BaseException as exc:
        _atomic_write(result_path, {
            'status': 'failed',
            'error': str(exc),
            'metrics': None,
            'artifacts': {'traceback': traceback.format_exc()[-12000:]},
        })
        return 1


def main() -> int:
    if len(sys.argv) != 5:
        print('Usage: python -m app.workers.run_child SNAPSHOT RESULT PROGRESS CANCEL', file=sys.stderr)
        return 64
    return execute(*(Path(value) for value in sys.argv[1:5]))


if __name__ == '__main__':
    raise SystemExit(main())
