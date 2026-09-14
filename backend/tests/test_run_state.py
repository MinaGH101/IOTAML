from datetime import timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.database import Base
from app.domains.runs.models import Run
from app.domains.runs.repository import run_repository
from app.core.time import utcnow_naive
from app.workflow.execution.run_state import merge_successful_run_state


def graph(*, b_value=1):
    return {
        'nodes': [
            {'id': 'a', 'type': 'mlNode', 'data': {'registryId': 'A', 'params': {}}},
            {'id': 'b', 'type': 'mlNode', 'data': {'registryId': 'B', 'params': {'value': b_value}}},
            {'id': 'c', 'type': 'mlNode', 'data': {'registryId': 'C', 'params': {}}},
            {'id': 'x', 'type': 'mlNode', 'data': {'registryId': 'X', 'params': {}}},
        ],
        'edges': [
            {'source': 'a', 'target': 'b', 'sourceHandle': 'out', 'targetHandle': 'in'},
            {'source': 'b', 'target': 'c', 'sourceHandle': 'out', 'targetHandle': 'in'},
        ],
        'meta': {'datasetId': 1, 'targetColumn': 'target', 'taskType': 'auto'},
    }


def status(key):
    return {'status': 'succeeded', 'cache_key': key}


def test_partial_run_retains_unaffected_results():
    artifacts, statuses, state = merge_successful_run_state(
        current_graph=graph(),
        current_artifacts={'node_outputs': {'a': {'value': 1}, 'b': {'value': 2}}},
        current_statuses={'a': status('a1'), 'b': status('b1')},
        previous_graph=graph(),
        previous_artifacts={'node_outputs': {'a': {'value': 1}, 'b': {'value': 2}, 'c': {'value': 3}, 'x': {'value': 9}}},
        previous_statuses={'a': status('a1'), 'b': status('b1'), 'c': status('c1'), 'x': status('x1')},
        previous_run_id=10,
    )
    assert set(artifacts['node_outputs']) == {'a', 'b', 'c', 'x'}
    assert set(statuses) == {'a', 'b', 'c', 'x'}
    assert state['invalidated_node_ids'] == []


def test_changed_upstream_invalidates_only_descendants():
    artifacts, statuses, state = merge_successful_run_state(
        current_graph=graph(b_value=2),
        current_artifacts={'node_outputs': {'a': {'value': 1}, 'b': {'value': 20}}},
        current_statuses={'a': status('a1'), 'b': status('b2')},
        previous_graph=graph(b_value=1),
        previous_artifacts={'node_outputs': {'a': {'value': 1}, 'b': {'value': 2}, 'c': {'value': 3}, 'x': {'value': 9}}},
        previous_statuses={'a': status('a1'), 'b': status('b1'), 'c': status('c1'), 'x': status('x1')},
        previous_run_id=10,
    )
    assert set(artifacts['node_outputs']) == {'a', 'b', 'x'}
    assert set(statuses) == {'a', 'b', 'x'}
    assert state['invalidated_node_ids'] == ['c']


def test_latest_successful_run_lookup_does_not_depend_on_workflow_pointer():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        older = Run(
            status="succeeded", workflow_name="Flow", workflow_graph={}, workflow_id=7,
            project_id=1, owner_username="admin", finished_at=utcnow_naive() - timedelta(minutes=1),
        )
        latest = Run(
            status="succeeded", workflow_name="Flow", workflow_graph={}, workflow_id=7,
            project_id=1, owner_username="admin", finished_at=utcnow_naive(),
        )
        failed = Run(
            status="failed", workflow_name="Flow", workflow_graph={}, workflow_id=7,
            project_id=1, owner_username="admin", finished_at=utcnow_naive() + timedelta(minutes=1),
        )
        db.add_all([older, latest, failed])
        db.commit()

        selected = run_repository.latest_successful_for_workflow(
            db, workflow_id=7, owner_username="admin", exclude_run_id=None,
        )

        assert selected is not None
        assert selected.id == latest.id


def test_running_a_second_node_retains_the_first_node_result():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    workflow_graph = graph()
    with Session(engine) as db:
        first_run = Run(
            status="succeeded",
            workflow_name="Flow",
            workflow_graph=workflow_graph,
            workflow_id=7,
            project_id=1,
            owner_username="admin",
            finished_at=utcnow_naive(),
            node_statuses={"a": status("a1")},
            artifacts={"node_outputs": {"a": {"node_id": "a", "value": 1}}},
        )
        second_run = Run(
            status="running",
            workflow_name="Flow",
            workflow_graph=workflow_graph,
            workflow_id=7,
            project_id=1,
            owner_username="admin",
            node_statuses={"x": status("x1")},
        )
        db.add_all([first_run, second_run])
        db.commit()

        previous = run_repository.latest_successful_for_workflow(
            db,
            workflow_id=7,
            owner_username="admin",
            exclude_run_id=second_run.id,
        )
        assert previous is not None

        artifacts, statuses, _ = merge_successful_run_state(
            current_graph=workflow_graph,
            current_artifacts={"node_outputs": {"x": {"node_id": "x", "value": 9}}},
            current_statuses={"x": status("x1")},
            previous_graph=previous.workflow_graph,
            previous_artifacts=previous.artifacts,
            previous_statuses=previous.node_statuses,
            previous_run_id=previous.id,
        )

        assert set(artifacts["node_outputs"]) == {"a", "x"}
        assert set(statuses) == {"a", "x"}


def test_queued_untouched_nodes_are_not_treated_as_executed():
    current_statuses = {
        'a': {'status': 'cached', 'cache_key': 'a1'},
        'b': {'status': 'cached', 'cache_key': 'b1'},
        'c': {'status': 'queued'},
        'x': {'status': 'succeeded', 'cache_key': 'x1'},
    }
    artifacts, statuses, state = merge_successful_run_state(
        current_graph=graph(),
        current_artifacts={
            'node_outputs': {
                'a': {'value': 1},
                'b': {'value': 2},
                'x': {'value': 9},
            },
            'execution_plan': {'selected_node_id': 'x', 'order': ['a', 'b', 'x']},
        },
        current_statuses=current_statuses,
        previous_graph=graph(),
        previous_artifacts={
            'node_outputs': {
                'a': {'value': 1},
                'b': {'value': 2},
                'c': {'value': 3},
            }
        },
        previous_statuses={
            'a': status('a1'),
            'b': status('b1'),
            'c': status('c1'),
        },
        previous_run_id=10,
    )

    assert set(artifacts['node_outputs']) == {'a', 'b', 'c', 'x'}
    assert statuses['c']['status'] == 'succeeded'
    assert state['retained_node_ids'] == ['c']
    assert state['invalidated_node_ids'] == []
