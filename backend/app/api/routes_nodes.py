from fastapi import APIRouter, HTTPException
from app.services.node_registry import get_node_categories, get_node_definition, get_node_registry

router = APIRouter(prefix='/nodes', tags=['nodes'])

@router.get('')
def list_nodes() -> list[dict]:
    return get_node_registry()

@router.get('/categories')
def list_categories() -> list[str]:
    return get_node_categories()

@router.get('/{node_id}')
def get_node(node_id: str) -> dict:
    node = get_node_definition(node_id)
    if not node:
        raise HTTPException(status_code=404, detail='Node not found.')
    return node
