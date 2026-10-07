from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.domains.workflows.locks import enforce_locked_execution, enforce_locked_graph_changes


def _graph(*, locked: bool = True, board_locked: bool = True) -> dict:
    return {
        'nodes': [
            {'id': 'source', 'position': {'x': 10, 'y': 20}, 'data': {'label': 'Source', 'ownerLocked': locked}},
            {'id': 'target', 'position': {'x': 220, 'y': 20}, 'data': {'label': 'Target'}},
        ],
        'edges': [{'id': 'edge-1', 'source': 'source', 'target': 'target'}],
        'meta': {'analysisBoards': [
            {'id': 'main', 'name': 'Main', 'locked': board_locked, 'items': [{'id': 'card-1'}]},
        ]},
    }


def test_owner_can_change_and_run_locked_resources() -> None:
    current = _graph()
    proposed = _graph()
    proposed['nodes'][0]['position']['x'] = 80
    proposed['meta']['analysisBoards'][0]['name'] = 'Renamed'
    enforce_locked_graph_changes(current, proposed, owner_username='owner', actor_username='OWNER')
    enforce_locked_execution(proposed, owner_username='owner', actor_username='owner')


@pytest.mark.parametrize('change', ['node', 'edge', 'board'])
def test_editor_cannot_change_locked_resources(change: str) -> None:
    current = _graph()
    proposed = _graph()
    if change == 'node':
        proposed['nodes'][0]['position']['x'] = 90
    elif change == 'edge':
        proposed['edges'] = []
    else:
        proposed['meta']['analysisBoards'][0]['items'].append({'id': 'card-2'})
    with pytest.raises(HTTPException) as exc:
        enforce_locked_graph_changes(current, proposed, owner_username='owner', actor_username='editor')
    assert exc.value.status_code == 423


def test_editor_cannot_create_locks_or_run_locked_node() -> None:
    current = _graph(locked=False, board_locked=False)
    proposed = _graph(locked=True, board_locked=False)
    with pytest.raises(HTTPException) as exc:
        enforce_locked_graph_changes(current, proposed, owner_username='owner', actor_username='editor')
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as run_exc:
        enforce_locked_execution(proposed, owner_username='owner', actor_username='editor')
    assert run_exc.value.status_code == 423


def test_editor_can_change_unlocked_resources() -> None:
    current = _graph(locked=False, board_locked=False)
    proposed = _graph(locked=False, board_locked=False)
    proposed['nodes'][0]['position']['x'] = 90
    proposed['edges'] = []
    proposed['meta']['analysisBoards'][0]['items'].append({'id': 'card-2'})
    enforce_locked_graph_changes(current, proposed, owner_username='owner', actor_username='editor')
