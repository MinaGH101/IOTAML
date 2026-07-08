from __future__ import annotations

import os
import traceback
from datetime import datetime

from redis import Redis
from rq import Queue

from app.database import SessionLocal
from app.models import Run
from app.services.workflow_executor import execute_workflow as execute_legacy_workflow
from app.workflow.executor import execute_scientific_workflow, is_legacy_graph

QUEUE_NAME = 'workflow-runs'


def _redis_queue() -> Queue | None:
    redis_url = os.getenv('REDIS_URL')
    if not redis_url:
        return None
    try:
        conn = Redis.from_url(redis_url)
        conn.ping()
        return Queue(QUEUE_NAME, connection=conn)
    except Exception:
        return None


def enqueue_run(run_id: int) -> None:
    queue = _redis_queue()
    if queue:
        queue.enqueue('app.services.jobs.execute_run', run_id, job_timeout='2h')
        return
    execute_run(run_id)


def execute_run(run_id: int) -> None:
    db = SessionLocal()
    try:
        run = db.get(Run, run_id)
        if not run:
            return
        run.status = 'running'
        run.started_at = datetime.utcnow()
        run.error = None
        db.commit()
        try:
            if is_legacy_graph(run.workflow_graph or {}):
                result = execute_legacy_workflow(run.workflow_graph or {}, run.dataset_id, run.target_column, run.task_type)
            else:
                result = execute_scientific_workflow(run.workflow_graph or {}, run.dataset_id, run.target_column, run.task_type, run.project_id, run.id)
            run.metrics = result.get('metrics')
            run.artifacts = result.get('artifacts')
            run.error = result.get('error')
            run.status = 'failed' if run.error else 'succeeded'
        except Exception as exc:
            run.status = 'failed'
            run.error = str(exc)
            run.artifacts = {'traceback': traceback.format_exc()[-4000:]}
        finally:
            run.finished_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()
