from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.domains.nodes.models import CustomNode
from app.schemas import CustomNodeCreate
from app.domains.components.service import component_to_registry_node, current_version, list_components
from app.domains.nodes.service import (
    create_custom_node, custom_node_to_api, get_catalog_metadata, get_current_user,
    get_node_categories, get_node_definition, get_node_registry, list_custom_nodes, update_custom_node,
)

router = APIRouter(prefix='/nodes', tags=['nodes'])


@router.get('')
def list_nodes(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    built_in = get_node_registry()
    custom = [custom_node_to_api(node) for node in list_custom_nodes(db, str(current_user['username']))]
    components = [component_to_registry_node(item, current_version(db, item)) for item in list_components(db, str(current_user['username'])) if current_version(db, item)]
    return [*built_in, *custom, *components]


@router.get('/categories')
def list_categories() -> list[str]:
    return get_node_categories()


@router.get('/catalog')
def get_catalog(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    metadata = get_catalog_metadata()
    custom = [custom_node_to_api(node) for node in list_custom_nodes(db, str(current_user['username']))]
    components = [component_to_registry_node(item, current_version(db, item)) for item in list_components(db, str(current_user['username'])) if current_version(db, item)]
    categories = list(dict.fromkeys([*(metadata.get('categories') or []), 'Components']))
    return {**metadata, 'categories': categories, 'nodes': [*get_node_registry(), *custom, *components]}


@router.post('/custom')
def create_user_node(payload: CustomNodeCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    node = create_custom_node(db, str(current_user['username']), payload)
    return custom_node_to_api(node, include_code=True)


@router.get('/custom/{node_id}')
def get_user_node(node_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    node = db.get(CustomNode, node_id)
    if not node or node.owner_username != str(current_user['username']):
        raise HTTPException(status_code=404, detail='Custom node not found.')
    return custom_node_to_api(node, include_code=True)


@router.put('/custom/{node_id}')
def update_user_node(node_id: str, payload: CustomNodeCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    node = db.get(CustomNode, node_id)
    if not node or node.owner_username != str(current_user['username']):
        raise HTTPException(status_code=404, detail='Custom node not found.')
    node = update_custom_node(db, node, payload)
    return custom_node_to_api(node, include_code=True)


@router.delete('/custom/{node_id}')
def delete_user_node(node_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    node = db.get(CustomNode, node_id)
    if not node or node.owner_username != str(current_user['username']):
        raise HTTPException(status_code=404, detail='Custom node not found.')
    db.delete(node)
    db.commit()
    return {'ok': True}


@router.get('/{node_id}')
def get_node(node_id: str) -> dict:
    node = get_node_definition(node_id)
    if not node:
        raise HTTPException(status_code=404, detail='Node not found.')
    return node
