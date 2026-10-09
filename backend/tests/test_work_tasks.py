from __future__ import annotations

import json
from datetime import timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core import model_registry  # noqa: F401
from app.core.database import Base
from app.domains.auth.models import User
from app.domains.projects.models import Project, ProjectAssignment
from app.domains.runs.models import Run
from app.domains.review_tasks.routes import TaskResponse, get_task, list_tasks, submit_task
from app.domains.review_tasks.service import persist_task_intents, persist_task_watches, queue_submission_continuations
from app.domains.review_tasks.models import ReviewTask
from app.domains.review_tasks.models import TaskSubmission, TaskSubmissionWatch
from app.domains.notifications.models import Notification
from app.domains.review_tasks.service import process_task_maintenance
from app.core.time import utcnow_naive
from app.nodes.tasks.nodes import AssignWorkTaskNode, FormAssignmentNode, GeneralAssignmentNode, LoadWorkResponsesNode
from app.workflow.execution.executor import execute_workflow
from app.infrastructure.queue.repository import claim_next_run, queue_retry
from app.workers.reliable_worker import _snapshot_run


def _node(name: str) -> dict:
    return {'id': name, 'type': 'WK-001', 'data': {'label': name, 'registryId': 'WK-001'}}


def test_assignment_types_share_context_and_use_typed_forms() -> None:
    source = {'schema_version': 1, 'case_id': 'P-3', 'fields': {'project_title': 'Proposal'},
              'field_labels': {'project_title': 'Title'}, 'documents': []}
    context = SimpleNamespace(execution_id=13)
    base = {'title': 'Check proposal', 'assignees': 'expert', 'due_days': 4}
    for kind in ('analysis', 'approval', 'form'):
        settings = {**base, 'task_kind': kind, 'response_fields': [
            {'id': 'confidence', 'label': 'Confidence', 'type': 'number', 'required': True, 'min': 0, 'max': 10}]}
        result = AssignWorkTaskNode().run(_node(f'assign-{kind}'), {'_by_port': {'source': [source]}}, settings, context)
        intent = result['_work_task_intent']
        assert intent['task_kind'] == kind
        assert intent['subject_id'] == 'P-3'
        assert intent['case_summary']['fields']['project_title'] == 'Proposal'
        assert intent['form']['fields'][0]['id'] == {'analysis': 'summary', 'approval': 'decision', 'form': 'confidence'}[kind]


def test_form_assignment_recovers_a_reversed_form_and_context_connection() -> None:
    extracted_case = {
        'schema_version': 1, 'case_id': 'P-4', 'fields': {'project_title': 'Extracted proposal'},
        'field_labels': {'project_title': 'Title'}, 'documents': [], 'forms': {},
    }
    form_case = {
        **extracted_case,
        'forms': {
            'expert_review': {
                'form_id': 'expert_review', 'title': 'Expert review', 'input_mode': 'dynamic',
                'fields': [{'id': 'score', 'label': 'Score', 'type': 'score', 'required': True, 'min': 0, 'max': 10}],
            },
        },
        'active_form_id': 'expert_review',
    }
    result = FormAssignmentNode().run(
        {'id': 'assign', 'type': 'WK-005', 'data': {'label': 'Assign', 'registryId': 'WK-005'}},
        {'_by_port': {'form': [extracted_case], 'context': [form_case]}},
        {'title': '', 'assignees': 'expert', 'due_mode': 'none'},
        SimpleNamespace(execution_id=13),
    )
    intent = result['_work_task_intent']
    assert intent['form_id'] == 'expert_review'
    assert intent['case_summary']['fields']['project_title'] == 'Extracted proposal'


def test_form_assignment_creates_one_task_per_case_in_a_dynamic_form_batch() -> None:
    def case(case_id: str, *, dynamic: bool) -> dict:
        forms = {'expert_review': {
            'form_id': 'expert_review', 'title': 'Expert review', 'input_mode': 'dynamic',
            'fields': [{'id': 'score', 'label': 'Score', 'type': 'score', 'required': True, 'min': 0, 'max': 10}],
        }} if dynamic else {}
        return {
            'schema_version': 1, 'case_id': case_id, 'fields': {'project_title': case_id},
            'field_labels': {'project_title': 'Title'}, 'documents': [], 'forms': forms,
            **({'active_form_id': 'expert_review'} if dynamic else {}),
        }

    result = FormAssignmentNode().run(
        {'id': 'assign', 'type': 'WK-005', 'data': {'label': 'Assign', 'registryId': 'WK-005'}},
        {'_by_port': {
            'form': [{'schema_version': 1, 'kind': 'case_batch', 'cases': [case('P-5', dynamic=True), case('P-6', dynamic=True)]}],
            'context': [{'schema_version': 1, 'kind': 'case_batch', 'cases': [case('P-5', dynamic=False), case('P-6', dynamic=False)]}],
        }},
        {'title': '', 'assignees': 'expert', 'due_mode': 'none'},
        SimpleNamespace(execution_id=14),
    )
    intents = result['_work_task_intents']
    assert result['task']['kind'] == 'work_task_batch'
    assert [intent['subject_id'] for intent in intents] == ['P-5', 'P-6']
    assert all(intent['form_id'] == 'expert_review' for intent in intents)


def test_claiming_a_manually_retried_run_continues_the_attempt_sequence() -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        run = Run(owner_username='owner', status='failed', attempts=1, workflow_graph={'nodes': [], 'edges': []})
        db.add(run); db.flush()
        from app.domains.runs.models import RunAttempt
        db.add(RunAttempt(run_id=run.id, attempt_number=1, status='failed'))
        db.commit()

        queue_retry(db, run, reset_attempts=True)
        claimed = claim_next_run(db, 'test-worker')

        assert claimed is not None
        assert claimed.attempts == 2


def test_private_submission_and_owner_visibility() -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(username='owner', email='owner@test.test', password_hash='x', role='expert', is_active=True)
        assignee = User(username='expert', email='expert@test.test', password_hash='x', role='expert', is_active=True)
        outsider = User(username='outsider', email='outsider@test.test', password_hash='x', role='expert', is_active=True)
        db.add_all([owner, assignee, outsider]); db.flush()
        project = Project(name='Project', owner_username='owner')
        db.add(project); db.flush()
        db.add(ProjectAssignment(project_id=project.id, user_id=assignee.id, access_type='view', assigned_by_user_id=owner.id))
        run = Run(project_id=project.id, owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        db.add(run); db.flush()
        intent = AssignWorkTaskNode().run(_node('assign'), {'_by_port': {'source': [{'output': {'title': 'Analysis report', 'metrics': {'rows': 3}}}]}},
                                          {'task_kind': 'approval', 'title': 'Approve results', 'assignees': 'expert', 'due_days': 4},
                                          SimpleNamespace(execution_id=run.id))['_work_task_intent']
        assert persist_task_intents(db, run, [intent]).created == 1
        db.commit()
        task = list_tasks(project_id=project.id, mine=True, task_kind=None, status=None, limit=100, db=db, user=assignee)[0]
        assert task['project_name'] == 'Project'
        assert task['task_kind'] == 'approval'
        assert task['subject_type'] == 'run'
        assert get_task(task['id'], db=db, user=owner)['title'] == 'Approve results'
        with pytest.raises(HTTPException) as hidden:
            get_task(task['id'], db=db, user=outsider)
        assert hidden.value.status_code == 404
        with pytest.raises(HTTPException) as invalid:
            submit_task(task['id'], TaskResponse(answers={'decision': 'reject'}), db=db, user=assignee)
        assert invalid.value.status_code == 422
        completed = submit_task(task['id'], TaskResponse(answers={'decision': 'reject', 'reason': 'Insufficient data'}), db=db, user=assignee)
        assert completed['status'] == 'completed'
        assert list_tasks(project_id=project.id, mine=False, task_kind=None, status=None, limit=100, db=db, user=owner)[0]['status'] == 'completed'
        assert db.scalar(select(Notification).where(
            Notification.recipient_user_id == owner.id,
            Notification.kind == 'task_submission_received',
        )) is not None
        assert any('پاسخ وظیفه' in item['title'] for item in db.get(User, owner.id).notifications)


def test_task_list_supports_exact_form_card_filters() -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(username='owner', email='owner@test.test', password_hash='x', role='expert', is_active=True)
        db.add(owner); db.flush()
        run = Run(owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        db.add(run); db.flush()
        intent = {'node_id': 'assign', 'case_id': 'SNR-100', 'form_id': 'expert_review',
                  'form': {'form_id': 'expert_review', 'title': 'Review', 'fields': []},
                  'assignees': ['owner'], 'case_summary': {'fields': {}, 'documents': []}}
        assert persist_task_intents(db, run, [intent]).created == 1
        db.commit()
        found = list_tasks(mine=True, run_id=run.id, form_id='expert_review', subject_id='SNR-100',
                           limit=100, db=db, user=owner)
        missing = list_tasks(mine=True, run_id=run.id, form_id='other', subject_id='SNR-100',
                             limit=100, db=db, user=owner)
        assert len(found) == 1
        assert missing == []


def test_global_admin_must_be_added_to_team_before_task_assignment() -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(username='owner', email='owner@test.test', password_hash='x', role='expert', is_active=True)
        admin = User(username='admin', email='admin@test.test', password_hash='x', role='admin', is_active=True)
        db.add_all([owner, admin]); db.flush()
        project = Project(name='Team project', owner_username='owner', project_type='team')
        db.add(project); db.flush()
        run = Run(project_id=project.id, owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        db.add(run); db.flush()
        intent = {'node_id': 'assign', 'subject_id': 'CASE-1', 'subject_type': 'case', 'task_kind': 'analysis',
                  'form_id': 'analysis', 'form': {'title': 'Analyze', 'fields': []},
                  'assignees': ['admin'], 'case_summary': {'fields': {}, 'documents': []}}
        with pytest.raises(ValueError, match='Assign them to the project first'):
            persist_task_intents(db, run, [intent])


def test_duplicate_review_assignment_nodes_create_one_task_per_reviewer() -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(username='owner', email='owner@test.test', password_hash='x', role='expert', is_active=True)
        db.add(owner); db.flush()
        run = Run(owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        db.add(run); db.flush()
        base = {'case_id': 'SNR-101', 'form_id': 'expert_review',
                'form': {'form_id': 'expert_review', 'title': 'Review', 'fields': []},
                'assignees': ['owner'], 'case_summary': {'fields': {}, 'documents': []}}
        assert persist_task_intents(db, run, [{**base, 'node_id': 'assign-a'},
                                               {**base, 'node_id': 'assign-b'}]).created == 1
        db.commit()
        assert len(db.scalars(select(ReviewTask)).all()) == 1


def test_rerun_skips_unchanged_review_task_but_reassigns_changed_form_or_pdf() -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(username='owner', email='owner@test.test', password_hash='x', role='expert', is_active=True)
        db.add(owner)
        db.flush()
        first_run = Run(owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        rerun = Run(owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        changed_form_run = Run(owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        changed_pdf_run = Run(owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        db.add_all([first_run, rerun, changed_form_run, changed_pdf_run])
        db.flush()
        base = {
            'node_id': 'assign', 'case_id': 'RDI-101', 'form_id': 'expert_review',
            'form': {'form_id': 'expert_review', 'title': 'Review', 'fields': [{'id': 'score', 'type': 'score'}]},
            'assignees': ['owner'],
            'case_summary': {
                'auto_case_id': True,
                'fields': {'project_code': 'RDI-101', 'project_title': 'Proposal'},
                'field_labels': {'project_code': 'Code', 'project_title': 'Title'},
                'documents': [{'artifact_id': 10, 'checksum_sha256': 'a' * 64, 'primary': True}],
            },
        }
        assert persist_task_intents(db, first_run, [base]).created == 1

        same_pdf_with_new_artifact_id = {
            **base,
            'case_id': 'RDI-102',
            'case_summary': {**base['case_summary'], 'fields': {
                'project_code': 'RDI-102', 'project_title': 'Proposal',
            }, 'documents': [
                {'artifact_id': 11, 'checksum_sha256': 'a' * 64, 'primary': True},
            ]},
        }
        unchanged = persist_task_intents(db, rerun, [same_pdf_with_new_artifact_id])
        assert unchanged.created == 0
        assert unchanged.unchanged == 1

        changed_form = persist_task_intents(db, changed_form_run, [{
            **same_pdf_with_new_artifact_id,
            'form': {**base['form'], 'fields': [
                {'id': 'score', 'type': 'score'}, {'id': 'reason', 'type': 'long_text'},
            ]},
        }])
        assert changed_form.created == 1

        changed_pdf = persist_task_intents(db, changed_pdf_run, [{
            **same_pdf_with_new_artifact_id,
            'case_summary': {**base['case_summary'], 'documents': [
                {'artifact_id': 12, 'checksum_sha256': 'b' * 64, 'primary': True},
            ]},
        }])
        assert changed_pdf.created == 1
        assert len(db.scalars(select(ReviewTask)).all()) == 3


def test_loader_returns_separate_assignee_answers() -> None:
    context = SimpleNamespace(work_task_data={'9': {'task_kind': 'analysis', 'title': 'Analyze', 'subject_id': 'P-3',
        'fields': [{'id': 'summary', 'label': 'Summary'}], 'responses': [
            {'task_id': 9, 'assignee': 'one', 'status': 'completed', 'answers': {'summary': 'Ready'}},
            {'task_id': 10, 'assignee': 'two', 'status': 'open', 'answers': None}]}})
    result = LoadWorkResponsesNode().run({'id': 'load', 'data': {'label': 'Load'}}, {}, {'task_id': 9}, context)
    assert result['responses']['assigned'] == 2
    assert result['responses']['completed'] == 1
    assert result['responses']['responses'][0]['answers']['summary'] == 'Ready'
    assert result['outputs'][1]['kind'] == 'table'
    assert result['outputs'][1]['source_handle'] == 'table'
    assert result['table']['_df'].to_dict(orient='records') == [
        {'summary': 'Ready', 'task_id': 9, 'assignee': 'one', 'subject_id': None, 'status': 'completed', 'submitted_at': None},
        {'summary': None, 'task_id': 10, 'assignee': 'two', 'subject_id': None, 'status': 'open', 'submitted_at': None},
    ]


def test_loader_reads_completed_responses_from_a_batched_assignment() -> None:
    context = SimpleNamespace(work_task_data={'node:assign:batch': {
        'task_id': 46, 'task_kind': 'form', 'title': 'Expert review',
        'subject_ids': ['proposal2', 'proposal1'], 'fields': [{'id': 'score', 'label': 'Score', 'type': 'score'}],
        'responses': [
            {'task_id': 46, 'assignee': 'iota.tech24@gmail.com', 'subject_id': 'proposal2',
             'status': 'completed', 'answers': {'score': 10}},
            {'task_id': 47, 'assignee': 'iota.tech24@gmail.com', 'subject_id': 'proposal1',
             'status': 'completed', 'answers': {'score': 8}},
        ],
    }})
    result = LoadWorkResponsesNode().run(
        {'id': 'load', 'data': {'label': 'Load'}},
        {'_by_port': {'assignment': [{'kind': 'work_task_batch', 'assignment_node_id': 'assign',
                                      'subjects': ['proposal2', 'proposal1']}]}},
        {}, context,
    )
    assert result['responses']['assigned'] == 2
    assert result['responses']['completed'] == 2
    assert result['responses']['subject_ids'] == ['proposal2', 'proposal1']


def test_get_submissions_snapshot_includes_every_assignee_in_the_current_form_batch(tmp_path) -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(username='owner', email='owner@test.test', password_hash='x', role='expert', is_active=True)
        first_reviewer = User(username='first', email='first@test.test', password_hash='x', role='expert', is_active=True)
        second_reviewer = User(username='second', email='second@test.test', password_hash='x', role='expert', is_active=True)
        db.add_all([owner, first_reviewer, second_reviewer]); db.flush()
        project = Project(name='Project', owner_username='owner')
        db.add(project); db.flush()
        first_assignment_run = Run(project_id=project.id, owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        second_assignment_run = Run(project_id=project.id, owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        get_submissions_run = Run(project_id=project.id, owner_username='owner', workflow_graph={
            'nodes': [
                {'id': 'assign', 'data': {'registryId': 'WK-005', 'params': {}}},
                {'id': 'get', 'data': {'registryId': 'WK-002', 'params': {}}},
            ],
            'edges': [{'source': 'assign', 'sourceHandle': 'task', 'target': 'get', 'targetHandle': 'assignment'}],
        })
        db.add_all([first_assignment_run, second_assignment_run, get_submissions_run]); db.flush()
        form = {'title': 'Proposal review', 'fields': [{'id': 'score', 'label': 'Score', 'type': 'number'}]}

        def task(run: Run, reviewer: User, subject_id: str, group_id: str, score: int) -> ReviewTask:
            return ReviewTask(
                project_id=project.id, run_id=run.id, node_id='assign', case_id=subject_id,
                form_id='proposal-review', task_kind='form', subject_type='case', subject_id=subject_id,
                assignee_user_id=reviewer.id, status='completed', form_json=form, case_summary={},
                assignment_group_id=group_id, response_json={'score': score}, completed_at=utcnow_naive(),
            )

        # The second assignment is the current batch.  Its group ids match the
        # earlier assignment, so Get Submissions must include both reviewers.
        db.add_all([
            task(first_assignment_run, first_reviewer, 'proposal-1', 'group-proposal-1', 7),
            task(first_assignment_run, first_reviewer, 'proposal-2', 'group-proposal-2', 8),
            task(second_assignment_run, second_reviewer, 'proposal-1', 'group-proposal-1', 9),
            task(second_assignment_run, second_reviewer, 'proposal-2', 'group-proposal-2', 10),
        ])
        db.flush()

        snapshot_path = tmp_path / 'snapshot.json'
        _snapshot_run(db, get_submissions_run, {
            'snapshot': snapshot_path,
            'custom_nodes': tmp_path / 'custom_nodes.json',
            'cache_input': tmp_path / 'cache-input',
            'cache_output': tmp_path / 'cache-output',
        })
        snapshot = json.loads(snapshot_path.read_text())
        responses = snapshot['work_task_data']['node:assign:batch']['responses']

        assert [response['task_id'] for response in responses] == [1, 2, 3, 4]
        assert {response['assignee'] for response in responses} == {'first', 'second'}
        assert [response['answers']['score'] for response in responses] == [7, 8, 9, 10]


def test_task_can_start_without_context_and_list_input_has_preview() -> None:
    settings = {'task_kind': 'analysis', 'title': 'Investigate issue', 'assignees': 'expert'}
    direct = AssignWorkTaskNode().run(_node('assign'), {}, settings, SimpleNamespace(execution_id=88))
    assert direct['_work_task_intent']['subject_id'] == '88'
    with_rows = AssignWorkTaskNode().run(_node('assign'), {'_by_port': {'source': [[{'json': {'sample': 'A', 'value': 3}}]]}},
                                          settings, SimpleNamespace(execution_id=88))
    assert with_rows['_work_task_intents'][0]['case_summary']['fields']['sample'] == 'A'
    three = AssignWorkTaskNode().run(_node('assign'), {'_by_port': {'source': [[
        {'json': {'id': 'P-1', 'title': 'First'}}, {'json': {'id': 'P-2', 'title': 'Second'}},
        {'json': {'id': 'P-3', 'title': 'Third'}}]]}}, settings, SimpleNamespace(execution_id=88))
    assert [intent['subject_id'] for intent in three['_work_task_intents']] == ['P-1', 'P-2', 'P-3']
    assert three['output']['assignee_count'] == 3


def test_three_items_create_three_private_tasks_in_one_run() -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(username='owner', email='owner@test.test', password_hash='x', role='expert', is_active=True)
        db.add(owner); db.flush()
        run = Run(owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        db.add(run); db.flush()
        batch = AssignWorkTaskNode().run(_node('assign'), {'_by_port': {'source': [[
            {'json': {'id': 'P-1'}}, {'json': {'id': 'P-2'}}, {'json': {'id': 'P-3'}}]]}},
            {'task_kind': 'analysis', 'title': 'Analyze proposal', 'assignees': 'owner'},
            SimpleNamespace(execution_id=run.id))
        assert persist_task_intents(db, run, batch['_work_task_intents']).created == 3
        db.commit()
        assert [task.subject_id for task in db.scalars(select(ReviewTask).order_by(ReviewTask.id)).all()] == ['P-1', 'P-2', 'P-3']


def test_general_assignment_deduplicates_across_runs_and_changed_input_creates_new_task() -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(username='owner', email='owner@test.test', password_hash='x', role='expert', is_active=True)
        db.add(owner); db.flush()
        first = Run(owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        second = Run(owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        changed = Run(owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        db.add_all([first, second, changed]); db.flush()
        settings = {'title': 'Inspect', 'assignees': 'owner', 'response_fields': [
            {'id': 'note', 'label': 'Note', 'type': 'text', 'required': True}], 'due_mode': 'none'}
        first_intent = GeneralAssignmentNode().run(_node('stable-node'), {}, settings, SimpleNamespace(execution_id=first.id))['_work_task_intent']
        second_intent = GeneralAssignmentNode().run(_node('stable-node'), {}, settings, SimpleNamespace(execution_id=second.id))['_work_task_intent']
        changed_intent = GeneralAssignmentNode().run(_node('stable-node'), {}, {**settings, 'instructions': 'New input'}, SimpleNamespace(execution_id=changed.id))['_work_task_intent']
        assert persist_task_intents(db, first, [first_intent]).created == 1
        skipped = persist_task_intents(db, second, [second_intent])
        assert skipped.unchanged == 1 and len(skipped.existing_task_ids) == 1
        assert persist_task_watches(db, second, [{
            'node_id': 'get', 'assignment_node_id': 'stable-node',
            'subject_id': second_intent['subject_id'], 'refresh_interval_minutes': 300,
        }], existing_task_ids=skipped.existing_task_ids) == 1
        original = db.get(ReviewTask, skipped.existing_task_ids[0])
        watch = db.scalar(select(TaskSubmissionWatch).where(TaskSubmissionWatch.source_run_id == second.id))
        assert watch is not None and original is not None
        assert watch.assignment_group_id == original.assignment_group_id
        assert persist_task_intents(db, changed, [changed_intent]).created == 1


def test_overdue_notification_is_emitted_once() -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(username='owner', email='owner@test.test', password_hash='x', role='expert', is_active=True)
        db.add(owner); db.flush()
        run = Run(owner_username='owner', workflow_graph={'nodes': [], 'edges': []})
        db.add(run); db.flush()
        task = ReviewTask(run_id=run.id, node_id='assign', case_id='1', form_id='form', task_kind='general',
                          subject_type='run', subject_id='1', assignee_user_id=owner.id,
                          form_json={'title': 'Late task', 'fields': []}, case_summary={},
                          due_at=utcnow_naive() - timedelta(minutes=1))
        db.add(task); db.flush()
        assert process_task_maintenance(db)['overdue_reminders'] == 1
        assert process_task_maintenance(db)['overdue_reminders'] == 0
        notices = db.scalars(select(Notification).where(Notification.kind == 'task_overdue')).all()
        assert len(notices) == 1


def test_get_submissions_defers_downstream_until_a_response_exists(tmp_path) -> None:
    graph = {
        'nodes': [
            {'id': 'assign', 'type': 'mlNode', 'data': {'registryId': 'WK-003', 'params': {
                'title': 'Collect note', 'assignees': 'owner', 'due_mode': 'none',
                'response_fields': [{'id': 'note', 'label': 'Note', 'type': 'text', 'required': True}],
            }}},
            {'id': 'get', 'type': 'mlNode', 'data': {'registryId': 'WK-002', 'params': {'refresh_hours': 5}}},
            {'id': 'after', 'type': 'mlNode', 'data': {'registryId': 'UT-002', 'params': {}}},
        ],
        'edges': [
            {'id': 'a', 'source': 'assign', 'sourceHandle': 'task', 'target': 'get', 'targetHandle': 'assignment'},
            {'id': 'b', 'source': 'get', 'sourceHandle': 'responses', 'target': 'after', 'targetHandle': 'input'},
        ],
    }
    result = execute_workflow(graph, None, None, 'auto', None, 99, run_path=tmp_path)
    assert result['metrics']['status'] == 'success'
    assert result['metrics']['nodes_executed'] == 2
    assert result['task_watch_intents'][0]['refresh_interval_minutes'] == 300


def test_submission_continuation_is_queued_once_per_watcher() -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(username='owner', email='owner@test.test', password_hash='x', role='expert', is_active=True)
        db.add(owner); db.flush()
        graph = {
            'nodes': [
                {'id': 'get', 'type': 'mlNode', 'data': {'registryId': 'WK-002', 'params': {'refresh_hours': 5}}},
                {'id': 'after', 'type': 'mlNode', 'data': {'registryId': 'UT-002', 'params': {}}},
            ],
            'edges': [{'id': 'edge', 'source': 'get', 'sourceHandle': 'responses',
                       'target': 'after', 'targetHandle': 'input'}],
        }
        source = Run(owner_username='owner', workflow_name='Submission flow', workflow_graph=graph)
        db.add(source); db.flush()
        task = ReviewTask(
            run_id=source.id, node_id='assign', case_id='item-1', form_id='general:assign',
            task_kind='general', subject_type='item', subject_id='item-1', assignee_user_id=owner.id,
            form_json={'title': 'Collect input', 'fields': []}, case_summary={},
            assignment_group_id='group-1', assignment_fingerprint='fingerprint-1',
        )
        db.add(task); db.flush()
        watch = TaskSubmissionWatch(
            source_run_id=source.id, node_id='get', assignment_group_id='group-1',
            owner_username='owner', refresh_interval_minutes=300, next_check_at=utcnow_naive(),
        )
        db.add(watch); db.flush()
        submission = TaskSubmission(
            task_id=task.id, assignment_group_id='group-1', assignee_user_id=owner.id,
            answers_json={'note': 'Ready'},
        )
        db.add(submission); db.flush()

        queued = queue_submission_continuations(db, task, submission)
        assert len(queued) == 1
        assert queued[0].selected_node_id == 'after'
        get_node = next(node for node in queued[0].workflow_graph['nodes'] if node['id'] == 'get')
        assert get_node['data']['params']['task_id'] == task.id
        assert queue_submission_continuations(db, task, submission) == []
