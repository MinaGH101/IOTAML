from __future__ import annotations

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
from app.domains.review_tasks.service import persist_task_intents
from app.domains.review_tasks.models import ReviewTask
from app.nodes.tasks.nodes import AssignWorkTaskNode, LoadWorkResponsesNode


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
