from __future__ import annotations

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core import model_registry  # noqa: F401
from app.core.database import Base
from app.domains.artifacts.models import Artifact
from app.domains.auth.models import User
from app.domains.cases.models import CaseRecord
from app.domains.cases.service import prepare_case_graph, queue_continuation_if_ready, sync_case_batch_from_run, sync_case_from_run
from app.domains.projects.models import Project
from app.domains.review_tasks.models import ReviewTask
from app.domains.runs.models import Run
from app.domains.runs.repository import run_repository


def graph() -> dict:
    return {'nodes': [
        {'id': 'intake', 'type': 'mlNode', 'data': {'registryId': 'RV-001', 'params': {}}},
        {'id': 'form', 'type': 'mlNode', 'data': {'registryId': 'RV-002', 'params': {'form_id': 'expert_review'}}},
        {'id': 'assign', 'type': 'mlNode', 'data': {'registryId': 'RV-009', 'params': {'form_id': 'expert_review'}}},
    ], 'edges': [
        {'id': 'a', 'source': 'intake', 'target': 'form', 'sourceHandle': 'case', 'targetHandle': 'case'},
        {'id': 'b', 'source': 'form', 'target': 'assign', 'sourceHandle': 'case', 'targetHandle': 'case'},
    ]}


def test_case_graph_binds_one_pdf_and_adds_disconnected_scoring_branch() -> None:
    case = CaseRecord(id=4, project_id=2, case_id='P-4', title='Fourth', fields_json={'proposer': 'Lab'},
                      primary_artifact_id=9, source_checksum='a' * 64, created_by='owner')
    bound, intake_target, score_target = prepare_case_graph(graph(), case, ['one', 'two'])
    by_registry = {node['data']['registryId']: node for node in bound['nodes']}
    assert json_case(by_registry['RV-001']['data']['params']['case_json'])['case_id'] == 'P-4'
    assert by_registry['RV-001']['data']['params']['proposal_pdf'] == 9
    assert by_registry['RV-009']['data']['params']['assignees'] == 'one,two'
    assert intake_target == 'assign'
    assert by_registry['RV-010']['data']['params']['case_id'] == 'P-4'
    assert score_target == by_registry['RV-007']['id']


def json_case(value: str) -> dict:
    import json
    return json.loads(value)


def test_last_review_queues_one_case_continuation_and_results_are_persisted() -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(username='owner', email='owner@test.test', password_hash='x', role='expert', is_active=True)
        reviewer = User(username='reviewer', email='reviewer@test.test', password_hash='x', role='expert', is_active=True)
        db.add_all([owner, reviewer]); db.flush()
        project = Project(name='Cases', owner_username='owner'); db.add(project); db.flush()
        case = CaseRecord(project_id=project.id, case_id='P-1', title='Proposal', fields_json={},
                          primary_artifact_id=1, source_checksum='b' * 64, created_by='owner')
        db.add(case); db.flush()
        source = Run(project_id=project.id, owner_username='owner', workflow_graph=graph(),
                     case_record_id=case.id, case_stage='intake')
        db.add(source); db.flush()
        task = ReviewTask(project_id=project.id, run_id=source.id, node_id='assign', case_id='P-1',
                          form_id='expert_review', subject_id='P-1', assignee_user_id=reviewer.id,
                          status='completed', form_json={'title': 'Score', 'fields': []},
                          case_summary={'fields': {}, 'documents': []}, response_json={'quality': 8})
        db.add(task); db.flush()
        continuation = queue_continuation_if_ready(db, task)
        assert continuation is not None
        assert continuation.case_record_id == case.id
        assert continuation.case_stage == 'scoring'
        assert queue_continuation_if_ready(db, task).id == continuation.id

        continuation.artifacts = {'node_outputs': {'score': {'kind': 'review_score', 'case_id': 'P-1',
            'scores': {'total': 8, 'maximum': 10, 'criteria': {'quality': 8}}}}}
        continuation.status = 'succeeded'
        sync_case_from_run(db, continuation, 'succeeded', continuation.artifacts)
        db.flush()
        stored = db.scalar(select(CaseRecord).where(CaseRecord.id == case.id))
        assert stored.status == 'completed'
        assert stored.score_total == 8
        assert stored.results_json['scores']['criteria']['quality'] == 8


def test_previous_workflow_output_is_scoped_to_the_same_case() -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add_all([
            Run(id=1, workflow_id=7, owner_username='owner', workflow_graph={}, case_record_id=10,
                status='succeeded'),
            Run(id=2, workflow_id=7, owner_username='owner', workflow_graph={}, case_record_id=11,
                status='succeeded'),
        ])
        db.flush()
        found = run_repository.latest_successful_for_workflow(
            db, workflow_id=7, owner_username='owner', case_record_id=10,
        )
        assert found is not None and found.id == 1


def test_standalone_workflow_output_does_not_inherit_a_case_run() -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add_all([
            Run(id=1, workflow_id=7, owner_username='owner', workflow_graph={}, case_record_id=None,
                status='succeeded'),
            Run(id=2, workflow_id=7, owner_username='owner', workflow_graph={}, case_record_id=10,
                status='succeeded'),
        ])
        db.flush()
        found = run_repository.latest_successful_for_workflow(
            db, workflow_id=7, owner_username='owner', case_record_id=None,
        )
        assert found is not None and found.id == 1


def test_batch_output_reuses_existing_case_with_the_same_pdf() -> None:
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(username='owner', email='owner@test.test', password_hash='x', role='expert', is_active=True)
        db.add(owner); db.flush()
        project = Project(name='Cases', owner_username='owner'); db.add(project); db.flush()
        artifact = Artifact(project_id=project.id, owner_username='owner', artifact_type='artifact',
                            storage_backend='local', object_key='proposal.pdf', original_filename='proposal.pdf',
                            logical_name='proposal.pdf', content_type='application/pdf', size_bytes=10,
                            checksum_sha256='c' * 64, status='available')
        db.add(artifact); db.flush()
        existing = CaseRecord(project_id=project.id, case_id='PROPOSAL-1', title='Proposal', fields_json={},
                              primary_artifact_id=artifact.id, source_checksum=artifact.checksum_sha256,
                              status='completed', score_total=8, score_maximum=10,
                              results_json={'scores': {'total': 8, 'maximum': 10}}, created_by='owner')
        db.add(existing); db.flush()
        run = Run(project_id=project.id, owner_username='owner', status='succeeded', workflow_graph={})
        db.add(run); db.flush()
        artifacts = {'node_outputs': {'extract': {'kind': 'review_batch', 'cases': [{
            'case_id': 'proposal', 'fields': {'project_code': 'proposal'},
            'documents': [{'artifact_id': artifact.id, 'primary': True}],
        }]}}}
        sync_case_batch_from_run(db, run, 'succeeded', artifacts)
        db.flush()
        cases = db.scalars(select(CaseRecord).where(CaseRecord.project_id == project.id)).all()
        assert len(cases) == 1
        assert cases[0].case_id == 'PROPOSAL-1'
        assert cases[0].status == 'completed'
        assert cases[0].results_json['stages']['extract']['case_id'] == 'PROPOSAL-1'
