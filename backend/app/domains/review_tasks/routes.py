"""Authenticated reviewer inbox and typed form submission."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.time import utcnow_naive
from app.domains.artifacts.models import Artifact
from app.domains.artifacts.service import create_artifact_from_upload
from app.domains.auth.models import ROLE_ADMIN, ROLE_MANAGER, User
from app.domains.auth.service import get_current_user_model, normalize_role
from app.domains.projects.access import permission_for_project, require_project_view
from app.domains.projects.models import Project
from app.domains.runs.models import Run
from app.nodes.review.contract import validate_response
from .models import ReviewTask
from app.domains.cases.service import publish_queued_run, queue_continuation_if_ready

router = APIRouter(prefix='/review-tasks', tags=['review-tasks'])
tasks_router = APIRouter(prefix='/tasks', tags=['tasks'])


class TaskResponse(BaseModel):
    answers: dict[str, object]


def _visible(db: Session, task: ReviewTask | None, user: User) -> ReviewTask:
    if not task:
        raise HTTPException(status_code=404, detail='Task not found.')
    if task.assignee_user_id == user.id:
        if task.project_id is not None:
            require_project_view(db, task.project_id, user)
        return task
    if task.project_id is not None:
        project = db.get(Project, task.project_id)
        if project and (normalize_role(user.role) in {ROLE_ADMIN, ROLE_MANAGER}
                        or project.owner_username.lower() == user.username.lower()):
            require_project_view(db, task.project_id, user)
            return task
    raise HTTPException(status_code=404, detail='Task not found.')


def _serialize(task: ReviewTask, *, detail: bool = False, assignee_username: str = '') -> dict:
    result = {'id': task.id, 'run_id': task.run_id, 'project_id': task.project_id,
              'case_id': task.case_id if task.subject_type == 'case' else None,
              'subject_type': task.subject_type, 'subject_id': task.subject_id or task.case_id,
              'task_kind': task.task_kind, 'instructions': task.instructions,
              'form_id': task.form_id, 'title': task.form_json.get('title') or task.form_id,
              'status': task.status, 'assignee_user_id': task.assignee_user_id, 'assignee_username': assignee_username,
              'due_at': task.due_at, 'created_at': task.created_at, 'completed_at': task.completed_at,
              'case_summary': task.case_summary}
    if detail:
        result['form'] = task.form_json
        result['response'] = task.response_json
    return result


@router.get('')
def list_tasks(project_id: int | None = None, mine: bool = True, task_kind: str | None = None,
               status: str | None = None, run_id: Annotated[int | None, Query(ge=1)] = None,
               form_id: Annotated[str | None, Query(min_length=1, max_length=64)] = None,
               subject_id: Annotated[str | None, Query(min_length=1, max_length=128)] = None,
               limit: int = Query(default=100, ge=1, le=200),
               db: Session = Depends(get_db), user: User = Depends(get_current_user_model)):
    query = select(ReviewTask)
    if mine:
        query = query.where(ReviewTask.assignee_user_id == user.id)
        if project_id is not None:
            require_project_view(db, project_id, user)
            query = query.where(ReviewTask.project_id == project_id)
    else:
        if project_id is None:
            raise HTTPException(status_code=400, detail='Choose a project to list its tasks.')
        require_project_view(db, project_id, user)
        project = db.get(Project, project_id)
        if not project or (normalize_role(user.role) not in {ROLE_ADMIN, ROLE_MANAGER}
                           and project.owner_username.lower() != user.username.lower()):
            raise HTTPException(status_code=403, detail='Only the project owner or a manager can list all tasks.')
        query = query.where(ReviewTask.project_id == project_id)
    if task_kind:
        if task_kind not in {'review', 'analysis', 'approval', 'form'}:
            raise HTTPException(status_code=422, detail='Unknown task type.')
        query = query.where(ReviewTask.task_kind == task_kind)
    if status:
        if status not in {'open', 'completed'}:
            raise HTTPException(status_code=422, detail='Unknown task status.')
        query = query.where(ReviewTask.status == status)
    if run_id is not None:
        query = query.where(ReviewTask.run_id == run_id)
    if form_id:
        query = query.where(ReviewTask.form_id == form_id)
    if subject_id:
        query = query.where(ReviewTask.subject_id == subject_id)
    items = db.scalars(query.order_by(ReviewTask.status, ReviewTask.due_at, ReviewTask.id.desc()).limit(limit)).all()
    if mine:
        allowed: dict[int, bool] = {}
        visible = []
        for item in items:
            if item.project_id is None:
                visible.append(item)
                continue
            if item.project_id not in allowed:
                project = db.get(Project, item.project_id)
                allowed[item.project_id] = bool(project and permission_for_project(db, project, user))
            if allowed[item.project_id]:
                visible.append(item)
        items = visible
    names = {person.id: person.username for person in db.scalars(select(User).where(
        User.id.in_({item.assignee_user_id for item in items}))).all()} if items else {}
    return [_serialize(item, assignee_username=names.get(item.assignee_user_id, '')) for item in items]


@router.get('/dashboard')
def review_dashboard(project_id: int | None = None, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user_model)):
    if normalize_role(user.role) not in {ROLE_ADMIN, ROLE_MANAGER}:
        raise HTTPException(status_code=403, detail='The review dashboard is for managers and administrators.')
    if project_id is not None:
        require_project_view(db, project_id, user)
    query = select(ReviewTask).where(ReviewTask.task_kind == 'review').order_by(ReviewTask.id.desc()).limit(2001)
    if project_id is not None:
        query = query.where(ReviewTask.project_id == project_id)
    elif normalize_role(user.role) == ROLE_MANAGER:
        query = query.where(ReviewTask.project_id.is_not(None))
    fetched = db.scalars(query).all()
    truncated = len(fetched) > 2000
    tasks = fetched[:2000]
    latest: dict[tuple, ReviewTask] = {}
    for task in tasks:
        key = (task.project_id, task.case_id, task.form_id, task.assignee_user_id)
        latest.setdefault(key, task)
    grouped: dict[tuple, list[ReviewTask]] = {}
    for task in latest.values():
        grouped.setdefault((task.project_id, task.case_id, task.form_id), []).append(task)
    now = utcnow_naive()
    cases = []
    for (case_project_id, case_id, form_id), members in grouped.items():
        completed = [task for task in members if task.status == 'completed']
        form = members[0].form_json
        score_fields = [field for field in form.get('fields', []) if field.get('type') == 'score']
        if not score_fields:
            score_fields = [field for field in form.get('fields', []) if field.get('type') == 'number']
        maximum = sum(float(field.get('max') or 0) for field in score_fields)
        totals = [sum(float(task.response_json[field['id']]) for field in score_fields)
                  for task in completed if score_fields and task.response_json and
                  all(isinstance(task.response_json.get(field['id']), (int, float)) and
                      not isinstance(task.response_json.get(field['id']), bool) for field in score_fields)]
        cases.append({'project_id': case_project_id, 'case_id': case_id, 'form_id': form_id,
                      'title': str(members[0].case_summary.get('fields', {}).get('project_title') or case_id),
                      'assigned': len(members), 'completed': len(completed),
                      'overdue': sum(task.status != 'completed' and bool(task.due_at and task.due_at < now) for task in members),
                      'score': round(sum(totals) / len(totals), 1) if totals else None,
                      'score_max': maximum if maximum > 0 else None,
                      'status': 'completed' if len(completed) == len(members) else 'awaiting_review'})
    cases.sort(key=lambda item: (item['status'] != 'awaiting_review', -item['overdue'], item['case_id']))
    return {'cases': cases[:200], 'case_count': len(cases), 'assigned_tasks': len(latest),
            'completed_tasks': sum(task.status == 'completed' for task in latest.values()),
            'overdue_tasks': sum(task.status != 'completed' and bool(task.due_at and task.due_at < now)
                                 for task in latest.values()), 'truncated': truncated}


@router.get('/assigned')
def assigned_form(run_id: int = Query(ge=1), form_id: str = Query(min_length=1, max_length=64),
                  case_id: str = Query(min_length=1, max_length=128), db: Session = Depends(get_db),
                  user: User = Depends(get_current_user_model)):
    """Small, private lookup for a pinned form card; never searches another user's tasks."""
    task = db.scalar(select(ReviewTask).where(ReviewTask.run_id == run_id,
                                              ReviewTask.form_id == form_id,
                                              ReviewTask.case_id == case_id,
                                              ReviewTask.assignee_user_id == user.id)
                     .order_by(ReviewTask.id.desc()).limit(1))
    if not task:
        raise HTTPException(status_code=404, detail='No form from this run is assigned to you.')
    return _serialize(_visible(db, task, user), detail=True, assignee_username=user.username)


@router.get('/{task_id}')
def get_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user_model)):
    task = _visible(db, db.get(ReviewTask, task_id), user)
    assignee = db.get(User, task.assignee_user_id)
    return _serialize(task, detail=True, assignee_username=assignee.username if assignee else '')


@router.post('/{task_id}/fields/{field_id}/upload')
def upload_task_file(task_id: int, field_id: str, file: UploadFile = File(...),
                     db: Session = Depends(get_db), user: User = Depends(get_current_user_model)):
    task = _visible(db, db.get(ReviewTask, task_id), user)
    if task.assignee_user_id != user.id:
        raise HTTPException(status_code=403, detail='Only the assignee can attach a file.')
    if task.status != 'open':
        raise HTTPException(status_code=409, detail='This task is already completed.')
    if not any(field.get('id') == field_id and field.get('type') == 'file'
               for field in task.form_json.get('fields', [])):
        raise HTTPException(status_code=422, detail='This form has no file field with that ID.')
    project = db.get(Project, task.project_id) if task.project_id else None
    owner = project.owner_username if project else user.username
    artifact = create_artifact_from_upload(
        db, upload=file, owner_username=owner, artifact_type='artifact',
        project_id=task.project_id,
        node_id=f'review-task-{task.id}-{field_id}',
    )
    return {'id': artifact.id, 'filename': artifact.original_filename}


@router.post('/{task_id}/submit')
def submit_task(task_id: int, payload: TaskResponse, db: Session = Depends(get_db),
                user: User = Depends(get_current_user_model)):
    task = _visible(db, db.get(ReviewTask, task_id), user)
    if task.assignee_user_id != user.id:
        raise HTTPException(status_code=403, detail='Only the assignee can submit this task.')
    if task.status == 'completed':
        if task.response_json == payload.answers:
            return _serialize(task, detail=True, assignee_username=user.username)
        raise HTTPException(status_code=409, detail='This task was already submitted. Ask the process owner to open a revision.')
    errors = validate_response(task.form_json['fields'], payload.answers)
    if task.task_kind == 'approval' and payload.answers.get('decision') in {'reject', 'revise'} and not str(payload.answers.get('reason') or '').strip():
        errors.append({'field': 'reason', 'code': 'required', 'message': 'A rejection or revision requires a reason.'})
    for field in task.form_json['fields']:
        if field['type'] != 'file' or not payload.answers.get(field['id']):
            continue
        artifact_id = str(payload.answers[field['id']])
        artifact = db.get(Artifact, int(artifact_id)) if artifact_id.isdigit() else None
        if not artifact or artifact.deleted_at is not None or artifact.status != 'available' or artifact.project_id != task.project_id or artifact.node_id != f'review-task-{task.id}-{field["id"]}':
            errors.append({'field': field['id'], 'code': 'file', 'message': 'Upload a file using this task form.'})
    if errors:
        raise HTTPException(status_code=422, detail={'code': 'REVIEW_RESPONSE_FIELDS_INVALID' if task.task_kind == 'review' else 'TASK_RESPONSE_FIELDS_INVALID', 'errors': errors})
    task.response_json = payload.answers
    task.status = 'completed'
    task.completed_at = utcnow_naive()
    continuation = queue_continuation_if_ready(db, task) if task.task_kind == 'review' else None
    run = db.get(Run, task.run_id)
    owner = db.scalar(select(User).where(User.username == run.owner_username)) if run else None
    if owner and owner.id != user.id:
        owner.notifications = ([{'title': 'پاسخ وظیفه ثبت شد',
                                 'message': f'{user.username}: {task.form_json.get("title") or task.form_id}'[:200],
                                 'time': utcnow_naive().isoformat(),
                                 'path': f'/tasks?project_id={task.project_id}' if task.project_id else '/tasks'}]
                               + list(owner.notifications or []))[:50]
    db.commit()
    db.refresh(task)
    publish_queued_run(continuation)
    return _serialize(task, detail=True, assignee_username=user.username)


# General task API. Existing review URLs stay valid for pinned forms and older clients.
tasks_router.add_api_route('', list_tasks, methods=['GET'])
tasks_router.add_api_route('/{task_id}', get_task, methods=['GET'])
tasks_router.add_api_route('/{task_id}/fields/{field_id}/upload', upload_task_file, methods=['POST'])
tasks_router.add_api_route('/{task_id}/submit', submit_task, methods=['POST'])
