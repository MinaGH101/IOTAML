"""Nodes domain routes for the IOTA ML backend."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domains.auth.models import ROLE_GUEST, User
from app.domains.auth.service import get_current_user_model, normalize_role
from app.domains.nodes.models import CustomNode
from app.domains.nodes.schemas import CustomNodeCreate
from app.domains.components.service import component_to_registry_node, current_version, list_components
from app.domains.projects.access import require_project_view
from app.domains.nodes.service import (
    create_custom_node, custom_node_to_api, get_catalog_metadata,
    get_node_categories, get_node_definition, get_node_registry, list_custom_nodes, update_custom_node,
)

router = APIRouter(prefix='/nodes', tags=['nodes'])


def _catalog_owner(db: Session, user: User, project_id: int | None) -> str:
    if project_id is None:
        return user.username
    project, _ = require_project_view(db, project_id, user)
    return project.owner_username


def _require_custom_node_write(user: User) -> None:
    if normalize_role(user.role) == ROLE_GUEST:
        raise HTTPException(status_code=403, detail='Guest users cannot create or edit custom nodes.')


@router.get('')
def list_nodes(project_id: int | None = None, current_user: User = Depends(get_current_user_model), db: Session = Depends(get_db)) -> list[dict]:
    built_in = get_node_registry()
    custom = [custom_node_to_api(node) for node in list_custom_nodes(db, current_user.username)]
    owner = _catalog_owner(db, current_user, project_id)
    components = [component_to_registry_node(item, current_version(db, item)) for item in list_components(db, owner, project_id) if current_version(db, item)]
    return [*built_in, *custom, *components]


@router.get('/categories')
def list_categories() -> list[str]:
    return get_node_categories()


@router.get('/catalog')
def get_catalog(project_id: int | None = None, current_user: User = Depends(get_current_user_model), db: Session = Depends(get_db)) -> dict:
    metadata = get_catalog_metadata()
    custom = [custom_node_to_api(node) for node in list_custom_nodes(db, current_user.username)]
    owner = _catalog_owner(db, current_user, project_id)
    components = [component_to_registry_node(item, current_version(db, item)) for item in list_components(db, owner, project_id) if current_version(db, item)]
    categories = list(dict.fromkeys([*(metadata.get('categories') or []), 'Components']))
    return {**metadata, 'categories': categories, 'nodes': [*get_node_registry(), *custom, *components]}


@router.post('/custom')
def create_user_node(payload: CustomNodeCreate, current_user: User = Depends(get_current_user_model), db: Session = Depends(get_db)) -> dict:
    _require_custom_node_write(current_user)
    node = create_custom_node(db, current_user.username, payload)
    return custom_node_to_api(node, include_code=True)


@router.get('/custom/{node_id}')
def get_user_node(node_id: str, current_user: User = Depends(get_current_user_model), db: Session = Depends(get_db)) -> dict:
    node = db.get(CustomNode, node_id)
    if not node or node.owner_username != current_user.username:
        raise HTTPException(status_code=404, detail='Custom node not found.')
    return custom_node_to_api(node, include_code=True)


@router.put('/custom/{node_id}')
def update_user_node(node_id: str, payload: CustomNodeCreate, current_user: User = Depends(get_current_user_model), db: Session = Depends(get_db)) -> dict:
    _require_custom_node_write(current_user)
    node = db.get(CustomNode, node_id)
    if not node or node.owner_username != current_user.username:
        raise HTTPException(status_code=404, detail='Custom node not found.')
    node = update_custom_node(db, node, payload)
    return custom_node_to_api(node, include_code=True)


@router.delete('/custom/{node_id}')
def delete_user_node(node_id: str, current_user: User = Depends(get_current_user_model), db: Session = Depends(get_db)) -> dict:
    _require_custom_node_write(current_user)
    node = db.get(CustomNode, node_id)
    if not node or node.owner_username != current_user.username:
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
