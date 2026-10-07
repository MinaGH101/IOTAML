"""Owner-managed workflow resource locks."""
from __future__ import annotations

from fastapi import HTTPException


def _nodes(graph: dict) -> dict[str, dict]:
    return {str(item.get('id')): item for item in graph.get('nodes', [])
            if isinstance(item, dict) and item.get('id') is not None}


def _boards(graph: dict) -> dict[str, dict]:
    meta = graph.get('meta') if isinstance(graph.get('meta'), dict) else {}
    return {str(item.get('id')): item for item in meta.get('analysisBoards', [])
            if isinstance(item, dict) and item.get('id') is not None}


def node_is_locked(node: dict) -> bool:
    data = node.get('data') if isinstance(node.get('data'), dict) else {}
    return data.get('ownerLocked') is True


def enforce_locked_graph_changes(current: dict, proposed: dict, *, owner_username: str,
                                 actor_username: str) -> None:
    """Reject edits to owner-locked nodes, their connections, or boards."""
    if owner_username.lower() == actor_username.lower():
        return
    old_nodes, new_nodes = _nodes(current), _nodes(proposed)
    locked_ids = {node_id for node_id, node in old_nodes.items() if node_is_locked(node)}
    for node_id in locked_ids:
        if new_nodes.get(node_id) != old_nodes[node_id]:
            raise HTTPException(status_code=423, detail='This node is locked by the project owner.')
    if any(node_is_locked(node) and not node_is_locked(old_nodes.get(node_id, {}))
           for node_id, node in new_nodes.items()):
        raise HTTPException(status_code=403, detail='Only the project owner can lock nodes.')
    old_edges = {str(item.get('id')): item for item in current.get('edges', []) if isinstance(item, dict)}
    new_edges = {str(item.get('id')): item for item in proposed.get('edges', []) if isinstance(item, dict)}
    old_incident = {key: edge for key, edge in old_edges.items()
                    if str(edge.get('source')) in locked_ids or str(edge.get('target')) in locked_ids}
    new_incident = {key: edge for key, edge in new_edges.items()
                    if str(edge.get('source')) in locked_ids or str(edge.get('target')) in locked_ids}
    if old_incident != new_incident:
        raise HTTPException(status_code=423, detail='Connections of an owner-locked node cannot be changed.')
    old_boards, new_boards = _boards(current), _boards(proposed)
    for board_id, board in old_boards.items():
        if board.get('locked') is True and new_boards.get(board_id) != board:
            raise HTTPException(status_code=423, detail='This board is locked by the project owner.')
    if any(board.get('locked') is True and old_boards.get(board_id, {}).get('locked') is not True
           for board_id, board in new_boards.items()):
        raise HTTPException(status_code=403, detail='Only the project owner can lock boards.')


def enforce_locked_execution(graph: dict, *, owner_username: str, actor_username: str) -> None:
    if owner_username.lower() == actor_username.lower():
        return
    locked = [str(node.get('data', {}).get('label') or node.get('id'))
              for node in graph.get('nodes', []) if isinstance(node, dict) and node_is_locked(node)]
    if locked:
        raise HTTPException(status_code=423,
                            detail=f'The project owner locked these nodes: {", ".join(locked[:5])}.')
