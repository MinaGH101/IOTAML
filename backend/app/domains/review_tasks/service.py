"""Validate and persist task intents emitted by trusted built-in nodes."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.time import utcnow_naive
from app.domains.auth.models import User
from app.domains.projects.models import Project, ProjectAssignment
from app.domains.runs.models import Run
from app.workflow.caching.keys import sha256_json
from .models import ReviewTask


@dataclass(frozen=True)
class TaskPersistenceResult:
    """Describe assignment work completed while finalizing a workflow run."""

    created: int = 0
    unchanged: int = 0
    duplicate_intents: int = 0

    def to_dict(self) -> dict[str, int]:
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


def persist_task_intents(db: Session, run: Run, intents: list[dict]) -> TaskPersistenceResult:
    if len(intents) > 100:
        raise ValueError('A run cannot assign more than 100 tasks.')
    project = db.get(Project, run.project_id) if run.project_id else None
    created = 0
    unchanged = 0
    duplicate_intents = 0
    seen_assignments: set[tuple] = set()
    for intent in intents:
        if not isinstance(intent, dict) or not {'node_id', 'form_id', 'form', 'assignees', 'case_summary'} <= intent.keys():
            raise ValueError('A node emitted an invalid task assignment.')
        task_kind = str(intent.get('task_kind') or 'review')
        subject_type = str(intent.get('subject_type') or 'case')
        subject_id = str(intent.get('subject_id') or intent.get('case_id') or '').strip()
        instructions = str(intent.get('instructions') or '').strip()
        if task_kind not in {'review', 'analysis', 'approval', 'form'} or subject_type not in {'case', 'run', 'item'} or not subject_id or len(subject_id) > 128 or len(instructions) > 4000:
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
                continue
            if task_kind == 'review':
                scope = [ReviewTask.node_id == str(intent['node_id']),
                         ReviewTask.form_id == str(intent['form_id']),
                         ReviewTask.task_kind == 'review',
                         ReviewTask.assignee_user_id == user.id]
                scope.append(ReviewTask.project_id == run.project_id
                             if run.project_id is not None else ReviewTask.project_id.is_(None))
                prior_tasks = db.scalars(select(ReviewTask).where(*scope).order_by(ReviewTask.id.desc())).all()
                if any(_same_review_task_input(task, form, intent['case_summary']) for task in prior_tasks):
                    seen_assignments.add(assignment_key)
                    unchanged += 1
                    continue
            db.add(ReviewTask(project_id=run.project_id, run_id=run.id, node_id=str(intent['node_id']),
                              case_id=subject_id, form_id=str(intent['form_id']), task_kind=task_kind,
                              instructions=instructions, subject_type=subject_type, subject_id=subject_id,
                              assignee_user_id=user.id, form_json=form, case_summary=intent['case_summary'],
                              due_at=utcnow_naive() + timedelta(days=int(form.get('due_days') or 7))))
            user.notifications = ([{'title': 'وظیفه جدید', 'message': str(form.get('title') or 'وظیفه جدید')[:160],
                                    'time': utcnow_naive().isoformat(), 'path': '/tasks'}]
                                  + list(user.notifications or []))[:50]
            seen_assignments.add(assignment_key)
            created += 1
    db.flush()
    return TaskPersistenceResult(created=created, unchanged=unchanged, duplicate_intents=duplicate_intents)
