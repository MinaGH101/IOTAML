from __future__ import annotations

import json
import multiprocessing
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
from sqlalchemy.orm import load_only

from app.config import get_settings
from app.database import SessionLocal
from app.models import CustomNode, Dataset, Run, Workflow
from app.domains.datasets.service import materialize_dataset
from app.domains.artifacts.service import cleanup_expired_artifacts, ingest_run_artifact_paths
from app.services.node_cache import cleanup_node_cache, persist_run_cache_records, prepare_cache_manifest
from app.services.jobs import QUEUE_NAME
from app.services.run_queue import claim_next_run, fail_or_requeue, recover_stale_runs
from app.services.run_state import append_log, progress_payload, utcnow


class WorkerWakeup:
    """Use Redis pub/sub for immediate queue wakeups with timed polling fallback."""

    def __init__(self) -> None:
        self._pubsub = None
        try:
            client = Redis.from_url(
                get_settings().redis_url,
                socket_connect_timeout=0.5,
                socket_timeout=0.5,
                health_check_interval=30,
            )
            self._pubsub = client.pubsub(ignore_subscribe_messages=True)
            self._pubsub.subscribe(QUEUE_NAME)
        except Exception:
            self._pubsub = None

    def wait(self, timeout: float) -> bool:
        timeout = max(0.05, float(timeout))
        if self._pubsub is None:
            time.sleep(timeout)
            return False
        try:
            return self._pubsub.get_message(timeout=timeout) is not None
        except Exception:
            try:
                self._pubsub.close()
            except Exception:
                pass
            self._pubsub = None
            time.sleep(timeout)
            return False

    def close(self) -> None:
        if self._pubsub is None:
            return
        try:
            self._pubsub.close()
        except Exception:
            pass


class ForkedProcessAdapter:
    """Expose the subset of subprocess.Popen used by the worker."""

    def __init__(self, process: multiprocessing.Process) -> None:
        self._process = process

    @property
    def pid(self) -> int:
        return int(self._process.pid or 0)

    @property
    def returncode(self) -> int | None:
        return self._process.exitcode

    def poll(self) -> int | None:
        return None if self._process.is_alive() else self._process.exitcode

    def wait(self, timeout: float | None = None) -> int | None:
        self._process.join(timeout)
        if self._process.is_alive():
            raise subprocess.TimeoutExpired('forked-workflow', timeout)
        return self._process.exitcode

    def terminate(self) -> None:
        self._process.terminate()

    def kill(self) -> None:
        if hasattr(self._process, 'kill'):
            self._process.kill()
        else:
            self._process.terminate()


def _preload_execution_runtime() -> None:
    """Import scientific dependencies once so Linux forked jobs start warm."""
    if os.name != 'posix' or not get_settings().job_use_fork_fast_path:
        return
    try:
        import numpy  # noqa: F401
        import pandas  # noqa: F401
        import sklearn  # noqa: F401
        from app.workflow import executor as scientific_executor  # noqa: F401
        from app.services import workflow_executor as legacy_executor  # noqa: F401
    except Exception:
        # The normal subprocess path remains available if preloading fails.
        return


def _run_forked_child(
    snapshot_path: str,
    result_path: str,
    progress_path: str,
    cancel_path: str,
    stdout_fd: int,
    stderr_fd: int,
    memory_mb: int,
    cpu_seconds: int,
    child_environment: dict[str, str],
) -> None:
    os.environ.update(child_environment)
    os.dup2(stdout_fd, 1)
    os.dup2(stderr_fd, 2)
    limiter = _resource_limiter(memory_mb, cpu_seconds)
    if limiter:
        limiter()
    from app.workers.run_child import execute
    code = execute(Path(snapshot_path), Path(result_path), Path(progress_path), Path(cancel_path))
    raise SystemExit(code)


@dataclass
class ActiveRun:
    run_id: int
    process: Any
    started_monotonic: float
    timeout_seconds: int
    paths: dict[str, Path]
    stdout_handle: IO[str]
    stderr_handle: IO[str]
    last_state_check_monotonic: float = 0.0
    last_heartbeat_monotonic: float = 0.0
    progress_mtime_ns: int = 0
    cancellation_sent_at: float | None = None


def _terminate_process(process: Any) -> None:
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
        'cache_input': root / 'cache-input',
        'cache_output': root / 'cache-output',
    }


def _snapshot_run(db, run: Run, paths: dict[str, Path]) -> None:
    dataset_path = None
    external_inputs: dict[str, Any] = {"datasets": {}, "primary_dataset_id": run.dataset_id}
    dataset_ids: set[int] = set()
    if run.dataset_id:
        dataset_ids.add(int(run.dataset_id))

    def collect_dataset_ids(value: Any, key: str | None = None) -> None:
        if isinstance(value, dict):
            for child_key, child in value.items():
                collect_dataset_ids(child, str(child_key))
        elif isinstance(value, list):
            for child in value:
                collect_dataset_ids(child, key)
        elif key and key.endswith("dataset_id"):
            try:
                dataset_ids.add(int(value))
            except (TypeError, ValueError):
                pass

    collect_dataset_ids(run.workflow_graph or {})
    for dataset_id in sorted(dataset_ids):
        dataset = db.get(Dataset, dataset_id)
        if not dataset:
            continue
        materialized = materialize_dataset(db, dataset)
        if dataset_id == run.dataset_id:
            dataset_path = str(materialized)
        external_inputs["datasets"][str(dataset_id)] = {
            "checksum_sha256": dataset.checksum_sha256,
            "artifact_id": dataset.artifact_id,
            "size_bytes": dataset.size_bytes,
            "row_count": dataset.row_count,
            "columns": dataset.columns,
        }

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

    cache_manifest = prepare_cache_manifest(db, run, paths['cache_input'])
    snapshot = {
        'run_id': run.id,
        'workflow_graph': run.workflow_graph,
        'workflow_id': run.workflow_id,
        'workflow_revision': run.workflow_revision,
        'dataset_id': run.dataset_id,
        'dataset_path': dataset_path,
        'project_id': run.project_id,
        'target_column': run.target_column,
        'task_type': run.task_type,
        'run_path': str(Path(get_settings().storage_dir) / 'runs' / str(run.id)),
        'network_disabled': get_settings().job_network_disabled,
        'external_inputs': external_inputs,
        'cache_manifest': cache_manifest,
        'cache_output_dir': str(paths['cache_output']),
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
        settings = get_settings()
        cpu_seconds = min(run.timeout_seconds + 5, settings.job_cpu_limit_seconds)
        use_fork = settings.job_use_fork_fast_path and os.name == 'posix' and 'fork' in multiprocessing.get_all_start_methods()
        if use_fork:
            context = multiprocessing.get_context('fork')
            raw_process = context.Process(
                target=_run_forked_child,
                args=(
                    str(paths['snapshot']),
                    str(paths['result']),
                    str(paths['progress']),
                    str(paths['cancel']),
                    stdout_handle.fileno(),
                    stderr_handle.fileno(),
                    settings.job_memory_limit_mb,
                    cpu_seconds,
                    _child_environment(paths),
                ),
                daemon=False,
            )
            raw_process.start()
            process = ForkedProcessAdapter(raw_process)
            launch_mode = 'warm-fork'
        else:
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
                preexec_fn=_resource_limiter(settings.job_memory_limit_mb, cpu_seconds),
            )
            launch_mode = 'subprocess'
        run.process_pid = process.pid
        run.logs = append_log(run.logs, 'info', 'Isolated execution process started.', pid=process.pid, launch_mode=launch_mode)
        db.commit()
        started = time.monotonic()
        return ActiveRun(
            run_id=run.id,
            process=process,
            started_monotonic=started,
            timeout_seconds=run.timeout_seconds,
            paths=paths,
            stdout_handle=stdout_handle,
            stderr_handle=stderr_handle,
            last_heartbeat_monotonic=started,
        )


def _read_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding='utf-8')) if path.exists() else None
    except (OSError, json.JSONDecodeError):
        return None


def _sync_progress(db, run: Run, active: ActiveRun, *, force: bool = False) -> bool:
    progress_path = active.paths['progress']
    try:
        mtime_ns = progress_path.stat().st_mtime_ns
    except OSError:
        return False
    if not force and mtime_ns == active.progress_mtime_ns:
        return False

    payload = _read_json(progress_path)
    if not payload:
        return False
    active.progress_mtime_ns = mtime_ns
    run.node_statuses = payload.get('node_statuses') or run.node_statuses
    next_progress = dict(payload.get('progress') or run.progress or {})
    if payload.get('updated_at') is not None:
        next_progress['updated_at'] = payload['updated_at']
    run.progress = next_progress
    return True


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
        _sync_progress(db, run, active, force=True)
        run.worker_exit_code = active.process.returncode
        status = forced_status or str(result.get('status') or ('succeeded' if active.process.returncode == 0 else 'failed'))
        if forced_status is None and active.process.returncode == -getattr(signal, 'SIGXCPU', 24):
            status = 'timed_out'
        error = forced_error or result.get('error') or (stderr.strip()[-3000:] if status != 'succeeded' else None)
        if status == 'timed_out' and not error:
            error = 'Run exceeded its CPU or wall-clock timeout.'
        cache_records = result.get('cache_records')
        if not cache_records:
            progress_payload_file = _read_json(active.paths['progress']) or {}
            cache_records = progress_payload_file.get('cache_records') or []
        cache_stats = {'hits': 0, 'writes': 0, 'bytes_written': 0}
        try:
            cache_stats = persist_run_cache_records(db, run, list(cache_records or []))
        except Exception as cache_exc:
            run.logs = append_log(run.logs, 'warning', 'Node cache metadata could not be fully persisted.', error=str(cache_exc))

        artifacts = result.get('artifacts')
        if stdout or stderr:
            artifacts = dict(artifacts or {})
            artifacts['worker_logs'] = {'stdout': stdout, 'stderr': stderr}
        try:
            artifacts = ingest_run_artifact_paths(db, run, artifacts)
        except Exception as artifact_exc:
            run.logs = append_log(run.logs, 'warning', 'Some run artifact files could not be persisted.', error=str(artifact_exc))
        run.metrics = {**(result.get('metrics') or {}), 'cache': cache_stats}
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
            if run.workflow_id is not None:
                workflow = db.get(Workflow, run.workflow_id)
                if workflow and workflow.owner_username == run.owner_username:
                    workflow.last_run_id = run.id
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
    settings = get_settings()

    # Process completion and wall-clock timeout are checked every fast worker tick,
    # while database heartbeat/progress writes are deliberately throttled.
    if active.process.poll() is not None:
        finalize_active(active)
        return True

    elapsed = now_mono - active.started_monotonic
    if elapsed > active.timeout_seconds:
        active.paths['cancel'].touch(exist_ok=True)
        _terminate_process(active.process)
        finalize_active(
            active,
            forced_status='timed_out',
            forced_error=f'Run exceeded timeout of {active.timeout_seconds} seconds.',
        )
        return True

    if now_mono - active.last_state_check_monotonic < settings.job_state_poll_interval_seconds:
        return False
    active.last_state_check_monotonic = now_mono

    should_cancel = False
    with SessionLocal() as db:
        run = db.execute(
            select(Run)
            .options(load_only(
                Run.id,
                Run.locked_by,
                Run.cancel_requested,
                Run.heartbeat_at,
                Run.node_statuses,
                Run.progress,
            ))
            .where(Run.id == active.run_id)
        ).scalar_one_or_none()
        if run is None or run.locked_by != worker_id:
            _terminate_process(active.process)
            active.stdout_handle.close()
            active.stderr_handle.close()
            return True

        dirty = _sync_progress(db, run, active)
        if now_mono - active.last_heartbeat_monotonic >= settings.job_heartbeat_interval_seconds:
            run.heartbeat_at = utcnow()
            active.last_heartbeat_monotonic = now_mono
            dirty = True
        should_cancel = bool(run.cancel_requested)
        if dirty:
            db.commit()

    if should_cancel:
        active.paths['cancel'].touch(exist_ok=True)
        _terminate_process(active.process)
        finalize_active(active, forced_status='cancelled', forced_error='Cancelled by user.')
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
    _preload_execution_runtime()
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
    last_health_publish = 0.0
    last_queue_poll = 0.0
    queue_woken = True
    wakeup = WorkerWakeup()

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
                cleanup_node_cache(db)
                db.commit()
            last_cleanup = now

        for run_id, item in list(active.items()):
            if monitor_active(item, worker_id):
                active.pop(run_id, None)

        can_claim = not stopping and len(active) < settings.job_worker_concurrency
        queue_poll_due = queue_woken or now - last_queue_poll >= settings.job_poll_interval_seconds
        if can_claim and queue_poll_due:
            last_queue_poll = now
            queue_woken = False
            while len(active) < settings.job_worker_concurrency:
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

        if now - last_health_publish >= settings.job_worker_health_interval_seconds:
            publish_worker_health(worker_id, len(active))
            last_health_publish = now
        wait_timeout = settings.job_active_poll_interval_seconds if active else settings.job_poll_interval_seconds
        queue_woken = wakeup.wait(wait_timeout) or queue_woken

    wakeup.close()
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
