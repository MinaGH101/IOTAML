from __future__ import annotations

import copy
import hashlib
import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.time import utcnow_naive
from app.domains.artifacts.models import Artifact
from app.domains.review_tasks.models import ReviewTask
from app.domains.runs.models import Run
from app.domains.runs.service import enqueue_run, initial_node_statuses, progress_payload
from app.workflow.compatibility import normalize_graph
from app.workflow.planning import build_execution_plan
from .models import CaseRecord


def _registry_id(node: dict[str, Any]) -> str:
    data = node.get('data') or {}
    return str(data.get('registryId') or node.get('type') or '')


def _params(node: dict[str, Any]) -> dict[str, Any]:
    data = node.setdefault('data', {})
    params = data.get('params')
    data['params'] = dict(params) if isinstance(params, dict) else {}
    return data['params']


def prepare_case_graph(graph: dict[str, Any], case: CaseRecord, assignees: list[str]) -> tuple[dict[str, Any], str, str]:
    """Bind one saved workflow to one case and ensure it has a continuation branch."""
    bound = copy.deepcopy(graph or {})
    nodes = bound.setdefault('nodes', [])
    edges = bound.setdefault('edges', [])
    intake = next((node for node in nodes if _registry_id(node) == 'RV-001'), None)
    assignments = [node for node in nodes if _registry_id(node) == 'RV-009']
    if intake is None or not assignments:
        raise ValueError('The workflow needs Case Intake and Assign Form Tasks nodes.')
    intake_params = _params(intake)
    intake_params['proposal_pdf'] = case.primary_artifact_id
    intake_params['supporting_files'] = []
    intake_params['input_mode'] = 'static'
    intake_params['case_json'] = json.dumps({
        'case_id': case.case_id,
        'fields': {**(case.fields_json or {}), 'project_code': case.case_id,
                   'project_title': case.title},
    }, ensure_ascii=False)

    assign = assignments[-1]
    assign_params = _params(assign)
    if assignees:
        assign_params['assignees'] = ','.join(assignees)
    form_id = str(assign_params.get('form_id') or 'expert_review')
    existing_ids = {str(node.get('id')) for node in nodes}
    loader = next((node for node in nodes if _registry_id(node) == 'RV-010'), None)
    if loader is None:
        loader_id = 'case-get-responses'
        suffix = 2
        while loader_id in existing_ids:
            loader_id = f'case-get-responses-{suffix}'; suffix += 1
        loader = {'id': loader_id, 'type': 'mlNode', 'position': {'x': 380, 'y': 760},
                  'data': {'registryId': 'RV-010', 'label': 'Get submitted scores', 'params': {}}}
        nodes.append(loader); existing_ids.add(loader_id)
    loader_params = _params(loader)
    loader_params.update({'case_id': case.case_id, 'form_id': form_id, 'response_target': 'reviews'})

    scorer = next((node for node in nodes if _registry_id(node) == 'RV-007'
                   and str(_params(node).get('form_id') or 'expert_review') == form_id), None)
    if scorer is None:
        scorer_id = 'case-aggregate-scores'
        suffix = 2
        while scorer_id in existing_ids:
            scorer_id = f'case-aggregate-scores-{suffix}'; suffix += 1
        scorer = {'id': scorer_id, 'type': 'mlNode', 'position': {'x': 740, 'y': 760},
                  'data': {'registryId': 'RV-007', 'label': 'Aggregate human scores',
                           'params': {'form_id': form_id, 'minimum_reviewers': 1}}}
        nodes.append(scorer)
    scorer_params = _params(scorer)
    scorer_params['form_id'] = form_id
    loader_id, scorer_id = str(loader['id']), str(scorer['id'])
    if not any(str(edge.get('source')) == loader_id and str(edge.get('target')) == scorer_id for edge in edges):
        edges.append({'id': f'{loader_id}-{scorer_id}', 'source': loader_id, 'sourceHandle': 'case',
                      'target': scorer_id, 'targetHandle': 'case'})
    return bound, str(assign['id']), scorer_id


def queue_continuation_if_ready(db: Session, task: ReviewTask) -> Run | None:
    """Queue the scoring branch once every current assignee has submitted."""
    case = db.scalar(select(CaseRecord).where(CaseRecord.project_id == task.project_id,
                                              CaseRecord.case_id == task.case_id))
    source = db.get(Run, task.run_id)
    if not case or not source:
        return None
    tasks = db.scalars(select(ReviewTask).where(
        ReviewTask.run_id == task.run_id, ReviewTask.case_id == task.case_id,
        ReviewTask.form_id == task.form_id, ReviewTask.task_kind == 'review',
    )).all()
    if not tasks or any(item.status != 'completed' for item in tasks):
        return None
    graph, _, scorer_id = prepare_case_graph(source.workflow_graph, case, [])
    key_raw = f'case-continuation:{case.id}:{task.run_id}:{task.form_id}'
    idempotency_key = hashlib.sha256(key_raw.encode()).hexdigest()
    existing = db.scalar(select(Run).where(Run.owner_username == source.owner_username,
                                            Run.idempotency_key == idempotency_key))
    if existing:
        return existing
    plan = build_execution_plan(normalize_graph(graph), scorer_id)
    statuses = initial_node_statuses(plan.graph)
    run = Run(
        workflow_name=f'{source.workflow_name} · {case.case_id} · scoring', workflow_graph=graph,
        workflow_id=source.workflow_id, workflow_revision=source.workflow_revision,
        project_id=case.project_id, owner_username=source.owner_username,
        case_record_id=case.id, case_stage='scoring', selected_node_id=scorer_id,
        task_type=source.task_type, bypass_cache=False, priority=source.priority,
        max_attempts=source.max_attempts, timeout_seconds=source.timeout_seconds,
        idempotency_key=idempotency_key, status='queued', queued_at=utcnow_naive(),
        node_statuses=statuses, progress=progress_payload(plan.graph, statuses),
        logs=[{'timestamp': utcnow_naive().isoformat() + 'Z', 'level': 'info',
               'message': 'All scoring forms were submitted; continuation queued automatically.', 'context': {}}],
    )
    db.add(run); db.flush()
    case.status = 'scoring'
    case.latest_run_id = run.id
    return run


def publish_queued_run(run: Run | None) -> None:
    if run is not None:
        enqueue_run(run.id)


def sync_case_from_run(db: Session, run: Run, status: str, artifacts: dict[str, Any] | None) -> None:
    if run.case_record_id is None:
        return
    case = db.get(CaseRecord, run.case_record_id)
    if not case:
        return
    case.latest_run_id = run.id
    if status != 'succeeded':
        case.status = status if status in {'queued', 'running'} else 'failed'
        case.results_json = {**(case.results_json or {}), 'last_error': run.error or 'Workflow failed'}
        return
    outputs = (artifacts or {}).get('node_outputs') or {}
    merged = dict(case.results_json or {})
    stages = dict(merged.get('stages') or {})
    for node_id, raw in outputs.items():
        values = raw if isinstance(raw, list) else [raw]
        for value in values:
            if not isinstance(value, dict):
                continue
            stages[str(node_id)] = value
            fields = value.get('fields')
            if isinstance(fields, dict):
                merged['fields'] = fields
            if isinstance(value.get('field_labels'), dict):
                merged['field_labels'] = value['field_labels']
            for key in ('validation', 'ai_review', 'scores', 'documents'):
                if value.get(key) not in (None, [], {}):
                    merged[key] = value[key]
    merged['stages'] = stages
    merged.pop('last_error', None)
    case.results_json = merged
    scores = merged.get('scores') if isinstance(merged.get('scores'), dict) else {}
    if scores:
        case.score_total = float(scores.get('total')) if scores.get('total') is not None else None
        case.score_maximum = float(scores.get('maximum')) if scores.get('maximum') is not None else None
        case.status = 'completed'
    elif run.case_stage == 'intake':
        has_tasks = bool(db.scalar(select(ReviewTask.id).where(ReviewTask.run_id == run.id).limit(1)))
        case.status = 'awaiting_review' if has_tasks else 'processed'
    else:
        case.status = 'processed'


def sync_case_batch_from_run(db: Session, run: Run, status: str, artifacts: dict[str, Any] | None) -> None:
    """Persist every case emitted by a manual multi-PDF workflow run."""
    if status != 'succeeded' or run.project_id is None or run.case_record_id is not None:
        return
    grouped: dict[str, dict[str, Any]] = {}
    for node_id, raw in (((artifacts or {}).get('node_outputs') or {}).items()):
        if not isinstance(raw, dict) or raw.get('kind') != 'review_batch':
            continue
        for preview in raw.get('cases') or []:
            if not isinstance(preview, dict):
                continue
            case_id = str(preview.get('case_id') or '').strip()
            if not case_id:
                continue
            entry = grouped.setdefault(case_id, {'stages': {}})
            entry['stages'][str(node_id)] = preview
            for key in ('fields', 'field_labels', 'documents', 'validation', 'ai_review', 'scores'):
                if preview.get(key) not in (None, [], {}):
                    entry[key] = preview[key]
    for case_id, results in grouped.items():
        documents = results.get('documents') if isinstance(results.get('documents'), list) else []
        raw_artifact_id = next((item.get('artifact_id') for item in documents
                                if isinstance(item, dict) and item.get('primary')), None)
        if raw_artifact_id is None:
            raw_artifact_id = next((item.get('artifact_id') for item in documents if isinstance(item, dict)), None)
        try:
            artifact_id = int(raw_artifact_id)
        except (TypeError, ValueError):
            continue
        artifact = db.get(Artifact, artifact_id)
        if not artifact or artifact.project_id != run.project_id:
            continue
        case = db.scalar(select(CaseRecord).where(CaseRecord.project_id == run.project_id,
                                                  CaseRecord.case_id == case_id))
        if case is None:
            case = db.scalar(select(CaseRecord).where(CaseRecord.project_id == run.project_id,
                                                      CaseRecord.source_checksum == artifact.checksum_sha256))
        fields = results.get('fields') if isinstance(results.get('fields'), dict) else {}
        if case is None:
            case = CaseRecord(project_id=run.project_id, case_id=case_id,
                              title=str(fields.get('project_title') or case_id)[:500], fields_json=fields,
                              primary_artifact_id=artifact_id, source_checksum=artifact.checksum_sha256,
                              status='processed', workflow_id=run.workflow_id, latest_run_id=run.id,
                              results_json=results, created_by=run.owner_username)
            db.add(case)
        else:
            canonical_case_id = case.case_id
            normalized_stages = {
                node_id: ({**preview, 'case_id': canonical_case_id} if isinstance(preview, dict) else preview)
                for node_id, preview in results['stages'].items()
            }
            merged = dict(case.results_json or {})
            merged.update({key: value for key, value in results.items() if key != 'stages'})
            if fields:
                merged['fields'] = {**(case.fields_json or {}), **fields, 'project_code': canonical_case_id}
            merged['stages'] = {**(merged.get('stages') or {}), **normalized_stages}
            case.results_json = merged
            case.fields_json = {**(case.fields_json or {}), **fields, 'project_code': canonical_case_id}
            case.workflow_id = run.workflow_id or case.workflow_id
            case.latest_run_id = run.id
        scores = results.get('scores') if isinstance(results.get('scores'), dict) else {}
        if scores:
            case.score_total = float(scores['total']) if scores.get('total') is not None else None
            case.score_maximum = float(scores['maximum']) if scores.get('maximum') is not None else None
            case.status = 'completed'
        else:
            case.status = 'completed' if case.score_total is not None else 'processed'
