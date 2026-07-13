from __future__ import annotations

import json
import os
import signal
import socket
import subprocess
import sys
import time
import uuid
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import IO, Any

from redis import Redis
from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.models import CustomNode, Dataset, Run
from app.domains.datasets.service import materialize_dataset
from app.domains.artifacts.service import cleanup_expired_artifacts, ingest_run_artifact_paths
from app.services.run_queue import claim_next_run, fail_or_requeue, recover_stale_runs
from app.services.run_state import append_log, progress_payload, utcnow


@dataclass
class ActiveRun:
    run_id: int
    process: subprocess.Popen[str]
    started_monotonic: float
    paths: dict[str, Path]
    stdout_handle: IO[str]
    stderr_handle: IO[str]
    cancellation_sent_at: float | None = None


def _terminate_process(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    try:
        if os.name == 'posix':
            os.killpg(process.pid, signal.SIGTERM)
        else:
            process.terminate()
        process.wait(timeout=5)
    except Exception:
        try:
            if os.name == 'posix':
                os.killpg(process.pid, signal.SIGKILL)
            else:
                process.kill()
        except Exception:
            pass


def _resource_limiter(memory_mb: int, cpu_seconds: int):
    if os.name != 'posix':
        return None

    def apply_limits() -> None:
        import resource
        os.setsid()
        memory_bytes = max(256, memory_mb) * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
        resource.setrlimit(resource.RLIMIT_CPU, (max(1, cpu_seconds), max(2, cpu_seconds + 1)))
        resource.setrlimit(resource.RLIMIT_NOFILE, (256, 256))
        resource.setrlimit(resource.RLIMIT_NPROC, (256, 256))

    return apply_limits


def _runtime_paths(run: Run) -> dict[str, Path]:
    root = Path(get_settings().storage_dir) / 'job-runtime' / f'run-{run.id}-attempt-{run.attempts}'
    root.mkdir(parents=True, exist_ok=True)
    return {
        'root': root,
        'snapshot': root / 'snapshot.json',
        'result': root / 'result.json',
        'progress': root / 'progress.json',
        'cancel': root / 'cancel.requested',
        'stdout': root / 'stdout.log',
        'stderr': root / 'stderr.log',
        'custom_nodes': root / 'custom_nodes.json',
    }


def _snapshot_run(db, run: Run, paths: dict[str, Path]) -> None:
    dataset_path = None
    if run.dataset_id:
        dataset = db.get(Dataset, run.dataset_id)
        if dataset:
            dataset_path = str(materialize_dataset(db, dataset))

    custom_ids = {
        str((node.get('data') or {}).get('registryId') or node.get('type') or '')
        for node in ((run.workflow_graph or {}).get('nodes') or [])
    }
    custom_ids = {node_id for node_id in custom_ids if node_id.startswith('UC-')}
    custom_payload: dict[str, Any] = {}
    if custom_ids:
        records = db.execute(select(CustomNode).where(CustomNode.id.in_(custom_ids))).scalars().all()
        custom_payload = {
            record.id: {
                'id': record.id,
                'name': record.name,
                'description': record.description,
                'inputs': record.inputs,
                'outputs': record.outputs,
                'code': record.code,
                'template': record.template,
            }
            for record in records
        }
    paths['custom_nodes'].write_text(json.dumps(custom_payload, ensure_ascii=False), encoding='utf-8')

    snapshot = {
        'run_id': run.id,
        'workflow_graph': run.workflow_graph,
        'dataset_id': run.dataset_id,
        'dataset_path': dataset_path,
        'project_id': run.project_id,
        'target_column': run.target_column,
        'task_type': run.task_type,
        'run_path': str(Path(get_settings().storage_dir) / 'runs' / str(run.id)),
        'network_disabled': get_settings().job_network_disabled,
    }
    paths['snapshot'].write_text(json.dumps(snapshot, ensure_ascii=False), encoding='utf-8')


def _child_environment(paths: dict[str, Path]) -> dict[str, str]:
    backend_root = str(Path(__file__).resolve().parents[2])
    env = {
        'PATH': os.environ.get('PATH', ''),
        'PYTHONPATH': backend_root,
        'LANG': os.environ.get('LANG', 'C.UTF-8'),
        'LC_ALL': os.environ.get('LC_ALL', 'C.UTF-8'),
        'STORAGE_DIR': get_settings().storage_dir,
        'JOB_NETWORK_DISABLED': '1' if get_settings().job_network_disabled else '0',
        'IOTA_CUSTOM_NODE_SNAPSHOT': str(paths['custom_nodes']),
        'PYTHONNOUSERSITE': '1',
        'PYTHONDONTWRITEBYTECODE': '1',
        'OPENBLAS_NUM_THREADS': '1',
        'OMP_NUM_THREADS': '1',
        'MKL_NUM_THREADS': '1',
        'NUMEXPR_NUM_THREADS': '1',
    }
    return env


def start_run(run_id: int, worker_id: str) -> ActiveRun:
    with SessionLocal() as db:
        run = db.get(Run, run_id)
        if run is None or run.status != 'running' or run.locked_by != worker_id:
            raise RuntimeError(f'Run {run_id} is not owned by worker {worker_id}.')
        paths = _runtime_paths(run)
        _snapshot_run(db, run, paths)
        stdout_handle = paths['stdout'].open('w', encoding='utf-8')
        stderr_handle = paths['stderr'].open('w', encoding='utf-8')
        command = [
            sys.executable,
            '-m',
            'app.workers.run_child',
            str(paths['snapshot']),
            str(paths['result']),
            str(paths['progress']),
            str(paths['cancel']),
        ]
        process = subprocess.Popen(
            command,
            cwd=paths['root'],
            env=_child_environment(paths),
            stdout=stdout_handle,
            stderr=stderr_handle,
            text=True,
            preexec_fn=_resource_limiter(get_settings().job_memory_limit_mb, min(run.timeout_seconds + 5, get_settings().job_cpu_limit_seconds)),
        )
        run.process_pid = process.pid
        run.logs = append_log(run.logs, 'info', 'Isolated execution process started.', pid=process.pid)
        db.commit()
        return ActiveRun(run.id, process, time.monotonic(), paths, stdout_handle, stderr_handle)


def _read_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding='utf-8')) if path.exists() else None
    except (OSError, json.JSONDecodeError):
        return None


def _sync_progress(db, run: Run, active: ActiveRun) -> None:
    payload = _read_json(active.paths['progress'])
    if not payload:
        return
    run.node_statuses = payload.get('node_statuses') or run.node_statuses
    run.progress = payload.get('progress') or progress_payload(run.workflow_graph or {}, run.node_statuses or {})


def finalize_active(active: ActiveRun, *, forced_status: str | None = None, forced_error: str | None = None) -> None:
    active.stdout_handle.close()
    active.stderr_handle.close()
    result = _read_json(active.paths['result']) or {}
    stdout = active.paths['stdout'].read_text(encoding='utf-8', errors='replace')[-8000:] if active.paths['stdout'].exists() else ''
    stderr = active.paths['stderr'].read_text(encoding='utf-8', errors='replace')[-8000:] if active.paths['stderr'].exists() else ''

    with SessionLocal() as db:
        run = db.get(Run, active.run_id)
        if run is None:
            return
        _sync_progress(db, run, active)
        run.worker_exit_code = active.process.returncode
        status = forced_status or str(result.get('status') or ('succeeded' if active.process.returncode == 0 else 'failed'))
        if forced_status is None and active.process.returncode == -getattr(signal, 'SIGXCPU', 24):
            status = 'timed_out'
        error = forced_error or result.get('error') or (stderr.strip()[-3000:] if status != 'succeeded' else None)
        if status == 'timed_out' and not error:
            error = 'Run exceeded its CPU or wall-clock timeout.'
        artifacts = result.get('artifacts')
        if stdout or stderr:
            artifacts = dict(artifacts or {})
            artifacts['worker_logs'] = {'stdout': stdout, 'stderr': stderr}
        try:
            artifacts = ingest_run_artifact_paths(db, run, artifacts)
        except Exception as artifact_exc:
            run.logs = append_log(run.logs, 'warning', 'Some run artifact files could not be persisted.', error=str(artifact_exc))
        run.metrics = result.get('metrics')
        run.artifacts = artifacts
        if status in {'cancelled', 'timed_out'}:
            updated_statuses = dict(run.node_statuses or {})
            for node_id, item in updated_statuses.items():
                item = dict(item)
                if item.get('status') in {'queued', 'running'}:
                    item['status'] = 'cancelled' if status == 'cancelled' else 'failed'
                    item['finished_at'] = utcnow().isoformat() + 'Z'
                    item['error'] = error
                updated_statuses[node_id] = item
            run.node_statuses = updated_statuses
            run.progress = progress_payload(run.workflow_graph or {}, updated_statuses)

        if status == 'succeeded':
            run.status = 'succeeded'
            run.error = None
            run.finished_at = utcnow()
            run.progress = {**(run.progress or {}), 'percent': 100.0}
            run.logs = append_log(run.logs, 'info', 'Run succeeded.', exit_code=active.process.returncode)
            run.locked_by = None
            run.locked_at = None
            run.heartbeat_at = None
            run.process_pid = None
        elif status == 'cancelled':
            run.cancel_requested = True
            fail_or_requeue(db, run, error=error or 'Cancelled by user.', status='cancelled')
        elif status == 'timed_out':
            fail_or_requeue(db, run, error=error or 'Run exceeded its timeout.', status='timed_out')
        else:
            fail_or_requeue(db, run, error=error or 'Workflow process failed.', status='failed')
        db.commit()


def monitor_active(active: ActiveRun, worker_id: str) -> bool:
    now_mono = time.monotonic()
    with SessionLocal() as db:
        run = db.get(Run, active.run_id)
        if run is None:
            _terminate_process(active.process)
            return True
        if run.locked_by != worker_id:
            _terminate_process(active.process)
            return True
        run.heartbeat_at = utcnow()
        _sync_progress(db, run, active)
        elapsed = now_mono - active.started_monotonic
        if run.cancel_requested:
            active.paths['cancel'].touch(exist_ok=True)
            _terminate_process(active.process)
            db.commit()
            finalize_active(active, forced_status='cancelled', forced_error='Cancelled by user.')
            return True
        if elapsed > run.timeout_seconds:
            active.paths['cancel'].touch(exist_ok=True)
            _terminate_process(active.process)
            db.commit()
            finalize_active(active, forced_status='timed_out', forced_error=f'Run exceeded timeout of {run.timeout_seconds} seconds.')
            return True
        db.commit()

    if active.process.poll() is not None:
        finalize_active(active)
        return True
    return False


def publish_worker_health(worker_id: str, active_count: int) -> None:
    try:
        redis = Redis.from_url(get_settings().redis_url, socket_connect_timeout=0.5, socket_timeout=0.5)
        redis.setex(f'iota:worker:{worker_id}', get_settings().job_stale_after_seconds, json.dumps({'active': active_count, 'host': socket.gethostname(), 'timestamp': time.time()}))
    except Exception:
        pass



def cleanup_old_runtime_directories() -> int:
    root = Path(get_settings().storage_dir) / 'job-runtime'
    if not root.exists():
        return 0
    cutoff = time.time() - (get_settings().job_runtime_retention_hours * 3600)
    removed = 0
    for child in root.iterdir():
        try:
            if child.is_dir() and child.stat().st_mtime < cutoff:
                shutil.rmtree(child, ignore_errors=True)
                removed += 1
        except OSError:
            continue
    return removed

def run_worker() -> None:
    settings = get_settings()
    worker_id = os.getenv('WORKER_ID') or f'{socket.gethostname()}-{os.getpid()}-{uuid.uuid4().hex[:8]}'
    stopping = False

    def stop(_signum, _frame):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    active: dict[int, ActiveRun] = {}
    last_recovery = 0.0
    last_cleanup = 0.0

    while not stopping or active:
        now = time.monotonic()
        if now - last_recovery >= settings.job_stale_after_seconds:
            with SessionLocal() as db:
                recover_stale_runs(db)
                db.commit()
            last_recovery = now
        if now - last_cleanup >= 3600:
            cleanup_old_runtime_directories()
            with SessionLocal() as db:
                cleanup_expired_artifacts(db)
                db.commit()
            last_cleanup = now

        for run_id, item in list(active.items()):
            if monitor_active(item, worker_id):
                active.pop(run_id, None)

        while not stopping and len(active) < settings.job_worker_concurrency:
            with SessionLocal.begin() as db:
                run = claim_next_run(db, worker_id)
                run_id = run.id if run else None
            if run_id is None:
                break
            try:
                active[run_id] = start_run(run_id, worker_id)
            except Exception as exc:
                with SessionLocal() as db:
                    failed = db.get(Run, run_id)
                    if failed:
                        fail_or_requeue(db, failed, error=f'Failed to start isolated process: {exc}')
                        db.commit()

        publish_worker_health(worker_id, len(active))
        time.sleep(settings.job_poll_interval_seconds)

    for item in active.values():
        _terminate_process(item.process)
        finalize_active(item, forced_status='failed', forced_error='Worker shut down during execution.')


def run_one(run_id: int) -> None:
    worker_id = f'one-shot-{os.getpid()}-{uuid.uuid4().hex[:8]}'
    with SessionLocal.begin() as db:
        run = db.get(Run, run_id, with_for_update=True)
        if run is None:
            return
        if run.status == 'queued':
            run.status = 'running'
            run.attempts += 1
            run.locked_by = worker_id
            run.locked_at = utcnow()
            run.heartbeat_at = utcnow()
            run.started_at = utcnow()
    active = start_run(run_id, worker_id)
    while not monitor_active(active, worker_id):
        time.sleep(0.25)


if __name__ == '__main__':
    run_worker()
