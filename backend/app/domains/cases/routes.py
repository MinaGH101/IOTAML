from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domains.artifacts.service import create_artifact_from_upload
from app.domains.auth.models import User
from app.domains.auth.service import get_current_user_model
from app.domains.projects.access import require_project_edit, require_project_view
from app.domains.review_tasks.models import ReviewTask
from app.domains.runs.models import Run
from app.domains.runs.routes import create_run
from app.domains.runs.schemas import RunCreate
from app.domains.workflows.models import Workflow
from .models import CaseRecord
from .service import prepare_case_graph

router = APIRouter(prefix='/cases', tags=['cases'])


class StartCasesRequest(BaseModel):
    project_id: int = Field(ge=1)
    workflow_id: int = Field(ge=1)
    case_record_ids: list[int] = Field(default_factory=list, max_length=100)
    assignees: list[str] = Field(default_factory=list, max_length=20)
    new_only: bool = False


def _serialize(case: CaseRecord) -> dict:
    return {
        'id': case.id, 'project_id': case.project_id, 'case_id': case.case_id, 'title': case.title,
        'fields': case.fields_json or {}, 'primary_artifact_id': case.primary_artifact_id,
        'status': case.status, 'workflow_id': case.workflow_id, 'latest_run_id': case.latest_run_id,
        'score': case.score_total, 'score_max': case.score_maximum,
        'results': case.results_json or {}, 'created_at': case.created_at, 'updated_at': case.updated_at,
    }


@router.post('/import')
def import_cases(project_id: int = Form(...), metadata: str = Form('[]'), files: list[UploadFile] = File(...),
                 db: Session = Depends(get_db), user: User = Depends(get_current_user_model)):
    project, _ = require_project_edit(db, project_id, user)
    if not files or len(files) > 100:
        raise HTTPException(status_code=422, detail='Choose between 1 and 100 PDF files.')
    try:
        rows = json.loads(metadata)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail='Case metadata must be valid JSON.') from exc
    if not isinstance(rows, list) or len(rows) != len(files):
        raise HTTPException(status_code=422, detail='Provide one metadata row for each PDF.')
    prepared: list[tuple[UploadFile, str, str, dict]] = []
    seen: set[str] = set()
    for index, (upload, row) in enumerate(zip(files, rows)):
        if Path(upload.filename or '').suffix.lower() != '.pdf':
            raise HTTPException(status_code=422, detail=f'File {index + 1} must be a PDF.')
        row = row if isinstance(row, dict) else {}
        fallback = re.sub(r'[^A-Za-z0-9_-]+', '-', Path(upload.filename or f'case-{index + 1}').stem).strip('-')
        case_id = str(row.get('case_id') or fallback or f'CASE-{index + 1}')[:128]
        if not re.fullmatch(r'[A-Za-z0-9_-]+', case_id) or case_id.lower() in seen:
            raise HTTPException(status_code=422, detail=f'Case ID {case_id!r} is invalid or duplicated in this import.')
        seen.add(case_id.lower())
        title = str(row.get('title') or Path(upload.filename or case_id).stem).strip()[:500]
        fields = row.get('fields') if isinstance(row.get('fields'), dict) else {}
        prepared.append((upload, case_id, title, fields))
    existing = set(db.scalars(select(func.lower(CaseRecord.case_id)).where(
        CaseRecord.project_id == project_id, func.lower(CaseRecord.case_id).in_(seen))).all())
    if existing:
        raise HTTPException(status_code=409, detail=f'Cases already exist: {", ".join(sorted(existing))}')
    created = []
    for upload, case_id, title, fields in prepared:
        artifact = create_artifact_from_upload(
            db, upload=upload, owner_username=project.owner_username, artifact_type='artifact',
            project_id=project_id, node_id=f'case-import-{case_id}', allowed_extensions={'.pdf'},
            allowed_content_types={'application/pdf', 'application/octet-stream'},
        )
        case = CaseRecord(project_id=project_id, case_id=case_id, title=title,
                          fields_json={**fields, 'project_code': case_id, 'project_title': title},
                          primary_artifact_id=artifact.id, source_checksum=artifact.checksum_sha256,
                          status='new', created_by=user.username)
        db.add(case); db.commit(); db.refresh(case); created.append(_serialize(case))
    return {'cases': created, 'count': len(created)}


@router.post('/run')
def run_cases(payload: StartCasesRequest, db: Session = Depends(get_db),
              user: User = Depends(get_current_user_model)):
    require_project_edit(db, payload.project_id, user)
    workflow = db.get(Workflow, payload.workflow_id)
    if not workflow or workflow.project_id != payload.project_id:
        raise HTTPException(status_code=404, detail='Workflow not found in this project.')
    query = select(CaseRecord).where(CaseRecord.project_id == payload.project_id)
    if payload.case_record_ids:
        query = query.where(CaseRecord.id.in_(payload.case_record_ids))
    if payload.new_only:
        query = query.where(CaseRecord.status == 'new')
    cases = db.scalars(query.order_by(CaseRecord.id).limit(100)).all()
    if not cases:
        raise HTTPException(status_code=422, detail='No matching cases are ready to run.')
    queued = []
    for case in cases:
        if case.status in {'queued', 'running', 'awaiting_review', 'scoring'}:
            continue
        try:
            graph, assign_id, _ = prepare_case_graph(workflow.graph, case, payload.assignees)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        prior_count = db.scalar(select(func.count(Run.id)).where(Run.case_record_id == case.id,
                                                                   Run.case_stage == 'intake')) or 0
        run = create_run(RunCreate(
            workflow_name=f'{workflow.name} · {case.case_id}', workflow_graph=graph,
            workflow_id=workflow.id, workflow_revision=workflow.revision, project_id=payload.project_id,
            case_record_id=case.id, case_stage='intake', selected_node_id=assign_id,
            idempotency_key=f'case-{case.id}-workflow-{workflow.id}-revision-{workflow.revision}-attempt-{prior_count + 1}',
        ), db=db, current_user=user, idempotency_header=None, _=None)
        case.workflow_id = workflow.id; case.latest_run_id = run.id; case.status = 'queued'
        db.commit(); queued.append({'case_id': case.case_id, 'run_id': run.id})
    return {'queued': queued, 'count': len(queued)}


@router.get('')
def list_cases(project_id: int, status: str | None = None, search: str = '', min_score: float | None = None,
               limit: int = Query(default=200, ge=1, le=500), db: Session = Depends(get_db),
               user: User = Depends(get_current_user_model)):
    require_project_view(db, project_id, user)
    query = select(CaseRecord).where(CaseRecord.project_id == project_id)
    if status:
        query = query.where(CaseRecord.status == status)
    if min_score is not None:
        query = query.where(CaseRecord.score_total >= min_score)
    if search.strip():
        term = f'%{search.strip().lower()}%'
        query = query.where(or_(func.lower(CaseRecord.case_id).like(term), func.lower(CaseRecord.title).like(term)))
    return [_serialize(case) for case in db.scalars(query.order_by(CaseRecord.updated_at.desc()).limit(limit)).all()]


@router.get('/response-options')
def response_options(project_id: int, form_id: str = 'expert_review', db: Session = Depends(get_db),
                     user: User = Depends(get_current_user_model)):
    """List review cases that an owner can load with RV-010."""
    require_project_view(db, project_id, user)
    rows = db.scalars(select(ReviewTask).where(
        ReviewTask.project_id == project_id, ReviewTask.form_id == form_id,
        ReviewTask.case_id.is_not(None),
    ).order_by(ReviewTask.id.desc()).limit(1000)).all()
    grouped: dict[str, dict] = {}
    seen: dict[str, set[int]] = {}
    for task in rows:
        case_id = str(task.case_id or '').strip()
        if not case_id:
            continue
        entry = grouped.setdefault(case_id, {
            'case_id': case_id,
            'title': str(((task.case_summary or {}).get('fields') or {}).get('project_title') or case_id),
            'form_id': task.form_id, 'assigned': 0, 'completed': 0,
        })
        users = seen.setdefault(case_id, set())
        if task.assignee_user_id in users:
            continue
        users.add(task.assignee_user_id)
        entry['assigned'] += 1
        if task.status == 'completed' and isinstance(task.response_json, dict):
            entry['completed'] += 1
    return list(grouped.values())


@router.get('/{case_record_id}')
def get_case(case_record_id: int, db: Session = Depends(get_db),
             user: User = Depends(get_current_user_model)):
    case = db.get(CaseRecord, case_record_id)
    if not case:
        raise HTTPException(status_code=404, detail='Case not found.')
    require_project_view(db, case.project_id, user)
    result = _serialize(case)
    tasks = db.execute(select(ReviewTask).where(ReviewTask.project_id == case.project_id,
                                                ReviewTask.case_id == case.case_id)
                       .order_by(ReviewTask.id)).scalars().all()
    result['reviews'] = [{'task_id': task.id, 'form_id': task.form_id, 'assignee_user_id': task.assignee_user_id,
                          'assignee': (db.get(User, task.assignee_user_id).username
                                       if db.get(User, task.assignee_user_id) else str(task.assignee_user_id)),
                          'status': task.status, 'answers': task.response_json,
                          'completed_at': task.completed_at} for task in tasks]
    result['runs'] = [{'id': run.id, 'stage': run.case_stage, 'status': run.status,
                       'error': run.error, 'created_at': run.created_at, 'finished_at': run.finished_at}
                      for run in db.scalars(select(Run).where(Run.case_record_id == case.id)
                                            .order_by(Run.id.desc())).all()]
    return result
