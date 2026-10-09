"""Validate and persist task intents emitted by trusted built-in nodes."""
from __future__ import annotations

import copy
import hashlib
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.time import utcnow_naive
from app.domains.auth.models import User
from app.domains.projects.models import Project, ProjectAssignment
from app.domains.runs.models import Run
from app.domains.runs.service import initial_node_statuses, progress_payload
from app.domains.notifications.service import create_notification
from app.workflow.compatibility import normalize_graph
from app.workflow.planning import build_execution_plan
from app.workflow.caching.keys import sha256_json
from .models import ReviewTask, TaskSubmission, TaskSubmissionWatch


@dataclass(frozen=True)
class TaskPersistenceResult:
    """Describe assignment work completed while finalizing a workflow run."""

    created: int = 0
    unchanged: int = 0
    duplicate_intents: int = 0
    existing_task_ids: list[int] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _same_document_inputs(previous: Any, current: Any) -> bool:
    """Compare task documents by content when possible, with legacy-ID fallback.

    Files are immutable artifacts, but older tasks do not have the checksum that
    current tasks retain.  Falling back to an artifact ID keeps those old task
    records idempotent after this change.  A re-upload of the same PDF (same
    checksum, different artifact ID) still counts as unchanged.
    """
    if not isinstance(previous, list) or not isinstance(current, list) or len(previous) != len(current):
        return False

    def key(item: Any) -> tuple[str, str, bool, str]:
        if not isinstance(item, dict):
            return ('', '', False, '')
        return (
            str(item.get('checksum_sha256') or ''),
            str(item.get('artifact_id') or ''),
            bool(item.get('primary', False)),
            str(item.get('pages') if item.get('pages') is not None else ''),
        )

    previous_items = sorted((item for item in previous if isinstance(item, dict)), key=key)
    current_items = sorted((item for item in current if isinstance(item, dict)), key=key)
    if len(previous_items) != len(current_items):
        return False
    for earlier, latest in zip(previous_items, current_items):
        if bool(earlier.get('primary', False)) != bool(latest.get('primary', False)):
            return False
        if earlier.get('pages') != latest.get('pages'):
            return False
        earlier_checksum = str(earlier.get('checksum_sha256') or '')
        latest_checksum = str(latest.get('checksum_sha256') or '')
        if earlier_checksum and latest_checksum:
            if earlier_checksum != latest_checksum:
                return False
        elif str(earlier.get('artifact_id') or '') != str(latest.get('artifact_id') or ''):
            return False
    return True


def _same_review_task_input(existing: ReviewTask, form: dict, case_summary: Any) -> bool:
    """Return whether a rerun would send exactly the same review task."""
    previous_summary = existing.case_summary if isinstance(existing.case_summary, dict) else {}
    latest_summary = case_summary if isinstance(case_summary, dict) else {}

    def input_fields(summary: dict[str, Any]) -> dict[str, Any]:
        fields = dict(summary.get('fields') or {})
        # Case Intake creates a new ``prefix-run_id`` code for every execution
        # when no real case ID is supplied.  That identifier is bookkeeping,
        # not changed task input, so it must not cause a new assignment.
        if summary.get('auto_case_id'):
            fields.pop('project_code', None)
        return fields

    return (
        sha256_json(existing.form_json) == sha256_json(form)
        and sha256_json(input_fields(previous_summary)) == sha256_json(input_fields(latest_summary))
        and sha256_json(previous_summary.get('field_labels') or {}) == sha256_json(latest_summary.get('field_labels') or {})
        and _same_document_inputs(previous_summary.get('documents') or [], latest_summary.get('documents') or [])
    )


def _normalized_summary(summary: Any) -> dict[str, Any]:
    if not isinstance(summary, dict):
        return {}
    normalized = dict(summary)
    fields = dict(normalized.get('fields') or {})
    if normalized.get('auto_case_id'):
        fields.pop('project_code', None)
    normalized['fields'] = fields
    documents = []
    for item in normalized.get('documents') or []:
        if not isinstance(item, dict):
            continue
        documents.append({
            'content': str(item.get('checksum_sha256') or item.get('artifact_id') or ''),
            'primary': bool(item.get('primary', False)),
            'pages': item.get('pages'),
        })
    normalized['documents'] = sorted(documents, key=lambda item: (item['content'], item['primary'], str(item['pages'])))
    return normalized


def _assignment_fingerprint(run: Run, intent: dict[str, Any], *, task_kind: str, subject_id: str,
                            assignee_user_id: int) -> str:
    summary = _normalized_summary(intent.get('case_summary'))
    subject_type = str(intent.get('subject_type') or 'case')
    stable_subject = '__generated__' if summary.get('auto_case_id') else '__run__' if subject_type == 'run' else subject_id
    origin = str(intent.get('form_id')) if task_kind == 'review' else str(intent.get('node_id'))
    return sha256_json({
        'project_id': run.project_id,
        'owner': run.owner_username.lower(),
        'workflow_id': run.workflow_id,
        'origin': origin,
        'task_kind': task_kind,
        'subject_type': subject_type,
        'subject_id': stable_subject,
        'assignee_user_id': assignee_user_id,
        'instructions': str(intent.get('instructions') or '').strip(),
        'form': intent.get('form') or {},
        'context': summary,
        'due_policy': intent.get('due_at') or (intent.get('form') or {}).get('due_days'),
    })


def _assignment_group_id(run: Run, intent: dict[str, Any], *, task_kind: str, subject_id: str) -> str:
    summary = _normalized_summary(intent.get('case_summary'))
    subject_type = str(intent.get('subject_type') or 'case')
    stable_subject = '__generated__' if summary.get('auto_case_id') else '__run__' if subject_type == 'run' else subject_id
    return sha256_json({
        'project_id': run.project_id,
        'owner': run.owner_username.lower(),
        'workflow_id': run.workflow_id,
        'origin': str(intent.get('form_id')) if task_kind == 'review' else str(intent.get('node_id')),
        'task_kind': task_kind,
        'subject_type': subject_type,
        'subject_id': stable_subject,
        'instructions': str(intent.get('instructions') or '').strip(),
        'form': intent.get('form') or {},
        'context': summary,
        'due_policy': intent.get('due_at') or (intent.get('form') or {}).get('due_days'),
    })


def _due_at(intent: dict[str, Any], form: dict[str, Any]) -> datetime | None:
    raw = intent.get('due_at') or form.get('due_at')
    if raw:
        try:
            parsed = datetime.fromisoformat(str(raw).replace('Z', '+00:00'))
        except ValueError as exc:
            raise ValueError('The task due date is invalid.') from exc
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed
    raw_days = form.get('due_days')
    if raw_days in (None, ''):
        return None
    return utcnow_naive() + timedelta(days=int(raw_days))


def persist_task_intents(db: Session, run: Run, intents: list[dict]) -> TaskPersistenceResult:
    if len(intents) > 100:
        raise ValueError('A run cannot assign more than 100 tasks.')
    project = db.get(Project, run.project_id) if run.project_id else None
    created = 0
    unchanged = 0
    duplicate_intents = 0
    existing_task_ids: list[int] = []
    seen_assignments: set[tuple] = set()
    for intent in intents:
        if not isinstance(intent, dict) or not {'node_id', 'form_id', 'form', 'assignees', 'case_summary'} <= intent.keys():
            raise ValueError('A node emitted an invalid task assignment.')
        task_kind = str(intent.get('task_kind') or 'review')
        subject_type = str(intent.get('subject_type') or 'case')
        subject_id = str(intent.get('subject_id') or intent.get('case_id') or '').strip()
        instructions = str(intent.get('instructions') or '').strip()
        if task_kind not in {'review', 'general', 'analysis', 'approval', 'form'} or subject_type not in {'case', 'run', 'item'} or not subject_id or len(subject_id) > 128 or len(instructions) > 4000:
            raise ValueError('Task type, subject, or instructions are invalid.')
        form = intent['form']
        if not isinstance(form, dict) or not isinstance(form.get('fields'), list):
            raise ValueError('The assigned form definition is invalid.')
        if not isinstance(intent['assignees'], list) or len(intent['assignees']) > 20:
            raise ValueError('Provide at most 20 task assignees.')
        if created + len(intent['assignees']) > 100:
            raise ValueError('A run cannot assign more than 100 tasks. Split the input into smaller batches.')
        for username in intent['assignees']:
            user = db.scalar(select(User).where(func.lower(User.username) == str(username).lower(), User.is_active.is_(True)))
            if not user:
                raise ValueError(f'Assignee {username} does not exist or is inactive.')
            if not project and user.username.lower() != run.owner_username.lower():
                raise ValueError('A task outside a project may only be assigned to its owner.')
            is_project_member = bool(project and (
                project.owner_username.lower() == user.username.lower()
                or db.scalar(select(ProjectAssignment.id).where(
                    ProjectAssignment.project_id == project.id,
                    ProjectAssignment.user_id == user.id,
                ))
            ))
            if project and not is_project_member:
                raise ValueError(f'Assignee {username} cannot access this project. Assign them to the project first.')
            assignment_key = ((task_kind, subject_id, str(intent['form_id']), user.id)
                              if task_kind == 'review'
                              else (task_kind, subject_id, str(intent['node_id']), user.id))
            if assignment_key in seen_assignments:
                duplicate_intents += 1
                continue
            duplicate_scope = [ReviewTask.run_id == run.id,
                               ReviewTask.subject_id == subject_id,
                               ReviewTask.assignee_user_id == user.id]
            if task_kind == 'review':
                # Two form-assignment nodes can converge on the same case.
                # One reviewer should still receive one copy of that form.
                duplicate_scope.extend((ReviewTask.task_kind == 'review',
                                        ReviewTask.form_id == str(intent['form_id'])))
            else:
                duplicate_scope.append(ReviewTask.node_id == intent['node_id'])
            existing = db.scalar(select(ReviewTask).where(*duplicate_scope))
            if existing:
                seen_assignments.add(assignment_key)
                duplicate_intents += 1
                existing_task_ids.append(existing.id)
                continue
            fingerprint = _assignment_fingerprint(run, intent, task_kind=task_kind, subject_id=subject_id,
                                                  assignee_user_id=user.id)
            unchanged_task = db.scalar(select(ReviewTask).where(
                ReviewTask.assignment_fingerprint == fingerprint,
                ReviewTask.assignment_fingerprint != '',
            ).order_by(ReviewTask.id.desc()))
            if unchanged_task is None and task_kind == 'review':
                legacy_scope = [ReviewTask.node_id == str(intent['node_id']), ReviewTask.form_id == str(intent['form_id']),
                                ReviewTask.task_kind == 'review', ReviewTask.assignee_user_id == user.id]
                legacy_scope.append(ReviewTask.project_id == run.project_id
                                    if run.project_id is not None else ReviewTask.project_id.is_(None))
                legacy_tasks = db.scalars(select(ReviewTask).where(*legacy_scope).order_by(ReviewTask.id.desc())).all()
                unchanged_task = next((task for task in legacy_tasks
                                       if _same_review_task_input(task, form, intent['case_summary'])), None)
            if unchanged_task:
                seen_assignments.add(assignment_key)
                unchanged += 1
                existing_task_ids.append(unchanged_task.id)
                continue
            group_id = _assignment_group_id(run, intent, task_kind=task_kind, subject_id=subject_id)
            task = ReviewTask(project_id=run.project_id, run_id=run.id, node_id=str(intent['node_id']),
                              case_id=subject_id, form_id=str(intent['form_id']), task_kind=task_kind,
                              instructions=instructions, subject_type=subject_type, subject_id=subject_id,
                              assignee_user_id=user.id, form_json=form, case_summary=intent['case_summary'],
                              assignment_group_id=group_id, assignment_fingerprint=fingerprint,
                              due_at=_due_at(intent, form))
            try:
                with db.begin_nested():
                    db.add(task)
                    db.flush()
            except IntegrityError:
                unchanged_task = db.scalar(select(ReviewTask).where(
                    ReviewTask.assignment_fingerprint == fingerprint,
                ))
                if unchanged_task is None:
                    raise
                seen_assignments.add(assignment_key)
                unchanged += 1
                existing_task_ids.append(unchanged_task.id)
                continue
            create_notification(
                db, recipient_user_id=user.id, kind='task_assigned', title='وظیفه جدید',
                message=str(form.get('title') or 'وظیفه جدید'), dedupe_key=f'task-assigned:{task.id}',
                path=f'/tasks?project_id={run.project_id}' if run.project_id else '/tasks',
                entity_type='task', entity_id=str(task.id),
            )
            # Keep legacy profile payloads populated during the normalized-notification migration.
            user.notifications = ([{'title': 'وظیفه جدید', 'message': str(form.get('title') or 'وظیفه جدید')[:160],
                                    'time': utcnow_naive().isoformat(), 'path': '/tasks'}]
                                  + list(user.notifications or []))[:50]
            seen_assignments.add(assignment_key)
            created += 1
    db.flush()
    return TaskPersistenceResult(created=created, unchanged=unchanged, duplicate_intents=duplicate_intents,
                                 existing_task_ids=list(dict.fromkeys(existing_task_ids))[:100])


def process_task_maintenance(db: Session, *, now: datetime | None = None, limit: int = 200) -> dict[str, int]:
    """Deliver overdue reminders and advance submission-watch cursors idempotently."""
    current = now or utcnow_naive()
    overdue = db.scalars(select(ReviewTask).where(
        ReviewTask.status == 'open', ReviewTask.due_at.is_not(None), ReviewTask.due_at <= current,
        ReviewTask.overdue_notified_at.is_(None),
    ).order_by(ReviewTask.due_at, ReviewTask.id).limit(limit)).all()
    reminded = 0
    for task in overdue:
        create_notification(
            db, recipient_user_id=task.assignee_user_id, kind='task_overdue',
            title='مهلت انجام وظیفه گذشته است',
            message=str(task.form_json.get('title') or task.form_id),
            dedupe_key=f'task-overdue:{task.id}',
            path=f'/tasks?project_id={task.project_id}' if task.project_id else '/tasks',
            entity_type='task', entity_id=str(task.id),
        )
        task.overdue_notified_at = current
        reminded += 1

    watches = db.scalars(select(TaskSubmissionWatch).where(
        TaskSubmissionWatch.active == 1, TaskSubmissionWatch.next_check_at <= current,
    ).order_by(TaskSubmissionWatch.next_check_at, TaskSubmissionWatch.id).limit(limit)).all()
    advanced = 0
    for watch in watches:
        query = select(TaskSubmission).where(TaskSubmission.assignment_group_id == watch.assignment_group_id)
        if watch.last_submission_id is not None:
            query = query.where(TaskSubmission.id > watch.last_submission_id)
        submissions = db.scalars(query.order_by(TaskSubmission.id).limit(limit)).all()
        if submissions:
            for submission in submissions:
                task = db.get(ReviewTask, submission.task_id)
                if task:
                    queue_submission_continuations(db, task, submission, watches=[watch])
            watch.last_submission_id = submissions[-1].id
            advanced += len(submissions)
        watch.next_check_at = current + timedelta(minutes=watch.refresh_interval_minutes)
    return {'overdue_reminders': reminded, 'submission_cursors_advanced': advanced}


def persist_task_watches(db: Session, run: Run, intents: list[dict[str, Any]],
                         existing_task_ids: list[int] | None = None) -> int:
    created = 0
    reusable_tasks = db.scalars(select(ReviewTask).where(
        ReviewTask.id.in_(existing_task_ids or [-1]),
    )).all()
    for intent in intents[:100]:
        assignment_node_id = str(intent.get('assignment_node_id') or '')
        subject_id = str(intent.get('subject_id') or '')
        node_id = str(intent.get('node_id') or '')
        if not assignment_node_id or not subject_id or not node_id:
            continue
        task = db.scalar(select(ReviewTask).where(
            ReviewTask.run_id == run.id, ReviewTask.node_id == assignment_node_id,
            ReviewTask.subject_id == subject_id,
        ).order_by(ReviewTask.id).limit(1))
        if task is None:
            task = next((candidate for candidate in reusable_tasks
                         if candidate.node_id == assignment_node_id), None)
        if not task or not task.assignment_group_id:
            continue
        existing = db.scalar(select(TaskSubmissionWatch).where(
            TaskSubmissionWatch.source_run_id == run.id, TaskSubmissionWatch.node_id == node_id,
            TaskSubmissionWatch.assignment_group_id == task.assignment_group_id,
        ))
        if existing:
            continue
        interval = max(5, min(10080, int(intent.get('refresh_interval_minutes') or 300)))
        db.add(TaskSubmissionWatch(
            project_id=run.project_id, source_run_id=run.id, node_id=node_id,
            assignment_group_id=task.assignment_group_id, owner_username=run.owner_username,
            refresh_interval_minutes=interval, next_check_at=utcnow_naive() + timedelta(minutes=interval),
        ))
        created += 1
    db.flush()
    return created


def _downstream_leaves(graph: dict[str, Any], source_id: str) -> list[str]:
    outgoing: dict[str, list[str]] = {}
    for edge in graph.get('edges') or []:
        outgoing.setdefault(str(edge.get('source')), []).append(str(edge.get('target')))
    reachable: set[str] = set()
    stack = [source_id]
    while stack:
        current = stack.pop()
        for target in outgoing.get(current, []):
            if target not in reachable:
                reachable.add(target)
                stack.append(target)
    leaves = [node_id for node_id in reachable if not any(target in reachable for target in outgoing.get(node_id, []))]
    return leaves or [source_id]


def queue_submission_continuations(db: Session, task: ReviewTask, submission: TaskSubmission,
                                   *, watches: list[TaskSubmissionWatch] | None = None) -> list[Run]:
    """Queue downstream processing once per watcher and submission."""
    selected_watches = watches or db.scalars(select(TaskSubmissionWatch).where(
        TaskSubmissionWatch.assignment_group_id == task.assignment_group_id,
        TaskSubmissionWatch.active == 1,
    )).all()
    queued: list[Run] = []
    for watch in selected_watches:
        source = db.get(Run, watch.source_run_id)
        if not source:
            continue
        graph = copy.deepcopy(source.workflow_graph or {})
        for graph_node in graph.get('nodes') or []:
            if str(graph_node.get('id')) != watch.node_id:
                continue
            data = graph_node.setdefault('data', {})
            params = data.get('params')
            data['params'] = {**(params if isinstance(params, dict) else {}), 'task_id': task.id}
        for leaf_id in _downstream_leaves(graph, watch.node_id):
            raw_key = f'task-submission:{submission.id}:watch:{watch.id}:leaf:{leaf_id}'
            idempotency_key = hashlib.sha256(raw_key.encode()).hexdigest()
            existing = db.scalar(select(Run).where(
                Run.owner_username == source.owner_username, Run.idempotency_key == idempotency_key,
            ))
            if existing:
                continue
            plan = build_execution_plan(normalize_graph(graph), leaf_id)
            statuses = initial_node_statuses(plan.graph)
            continuation = Run(
                workflow_name=f'{source.workflow_name} · submission', workflow_graph=graph,
                workflow_id=source.workflow_id, workflow_revision=source.workflow_revision,
                project_id=source.project_id, owner_username=source.owner_username,
                selected_node_id=leaf_id, task_type=source.task_type, bypass_cache=False,
                priority=source.priority, max_attempts=source.max_attempts,
                timeout_seconds=source.timeout_seconds, idempotency_key=idempotency_key,
                status='queued', queued_at=utcnow_naive(), node_statuses=statuses,
                progress=progress_payload(plan.graph, statuses),
                logs=[{'timestamp': utcnow_naive().isoformat() + 'Z', 'level': 'info',
                       'message': 'A new task submission queued downstream processing.', 'context': {}}],
            )
            db.add(continuation)
            db.flush()
            queued.append(continuation)
    return queued
