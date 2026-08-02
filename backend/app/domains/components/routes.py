"""Reusable workflow-component API with project-level authorization."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import NotFoundError
from app.domains.auth.models import User
from app.domains.auth.service import get_current_user_model
from app.domains.components.models import WorkflowComponent
from app.domains.components.repository import component_repository
from app.domains.components.schemas import (
    ComponentCreate, ComponentImportPackage, ComponentOut, ComponentUpdate,
    ComponentVersionCreate, ComponentVersionOut, ComponentVersionSummaryOut,
)
from app.domains.components.service import (
    component_to_registry_node, create_component, create_component_version, current_version,
    delete_component, delete_component_version, export_component, get_component,
    import_component, list_components, set_current_version, update_component, usage_count,
)
from app.domains.projects.access import require_project_edit, require_project_view

router = APIRouter(prefix='/components', tags=['components'])


def _out(db: Session, component: WorkflowComponent) -> dict:
    version = current_version(db, component)
    return {
        **{column.name: getattr(component, column.name) for column in component.__table__.columns},
        'current_version': version,
        'usage_count': usage_count(db, component.id),
    }


def _component_context(db: Session, component_id: int, user: User, *, write: bool = False):
    component = db.get(WorkflowComponent, component_id)
    if not component:
        raise NotFoundError('COMPONENT_NOT_FOUND', 'Component not found.', {'component_id': component_id})
    if component.visibility == 'project':
        if component.project_id is None:
            raise NotFoundError('COMPONENT_NOT_FOUND', 'Component not found.', {'component_id': component_id})
        project, permission = (require_project_edit if write else require_project_view)(db, component.project_id, user)
        return component, project.owner_username, permission
    if write or component.visibility == 'private':
        if component.owner_username.lower() != user.username.lower():
            raise NotFoundError('COMPONENT_NOT_FOUND', 'Component not found.', {'component_id': component_id})
    return component, component.owner_username, None


def _create_owner(db: Session, payload: ComponentCreate, user: User) -> str:
    if payload.visibility != 'project':
        return user.username
    if payload.project_id is None:
        raise HTTPException(status_code=400, detail='Project visibility requires a project.')
    project, _ = require_project_edit(db, payload.project_id, user)
    return project.owner_username


@router.get('', response_model=list[ComponentOut])
def list_all(project_id: int | None = None, include_archived: bool = False, limit: int = Query(default=50, ge=1), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    owner = current_user.username
    if project_id is not None:
        project, _ = require_project_view(db, project_id, current_user)
        owner = project.owner_username
    return [_out(db, item) for item in list_components(db, owner, project_id, include_archived, limit=min(limit, get_settings().api_max_page_size), offset=offset)]


@router.post('', response_model=ComponentOut)
def create(payload: ComponentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    return _out(db, create_component(db, payload, _create_owner(db, payload, current_user)))


@router.post('/import', response_model=ComponentOut)
def import_package(payload: ComponentImportPackage, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    # Portable imports intentionally create private components; users may later
    # publish them into a project they own through the normal update flow.
    return _out(db, import_component(db, payload, current_user.username))


@router.get('/{component_id}', response_model=ComponentOut)
def get_one(component_id: int, project_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    component, owner, _ = _component_context(db, component_id, current_user)
    if project_id is not None and component.project_id != project_id:
        raise NotFoundError('COMPONENT_NOT_FOUND', 'Component not found.', {'component_id': component_id})
    return _out(db, get_component(db, component_id, owner, component.project_id))


@router.patch('/{component_id}', response_model=ComponentOut)
def update(component_id: int, payload: ComponentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    component, owner, permission = _component_context(db, component_id, current_user, write=True)
    changing_scope = payload.visibility is not None and payload.visibility != component.visibility
    changing_project = payload.project_id is not None and payload.project_id != component.project_id
    if permission and (changing_scope or changing_project) and not permission.can_manage_assignments:
        raise HTTPException(status_code=403, detail='Only the project owner or an admin can change component visibility.')
    return _out(db, update_component(db, component_id, payload, owner))


@router.delete('/{component_id}')
def remove(component_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner, _ = _component_context(db, component_id, current_user, write=True)
    delete_component(db, component_id, owner)
    return {'ok': True}


@router.get('/{component_id}/versions', response_model=list[ComponentVersionSummaryOut])
def versions(component_id: int, project_id: int | None = None, limit: int = Query(default=100, ge=1), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    component, _, _ = _component_context(db, component_id, current_user)
    if project_id is not None and component.project_id != project_id:
        raise NotFoundError('COMPONENT_NOT_FOUND', 'Component not found.', {'component_id': component_id})
    return component_repository.list_versions(db, component_id, limit=min(limit, get_settings().api_max_page_size), offset=offset)


@router.get('/{component_id}/versions/{version_id}', response_model=ComponentVersionOut)
def version(component_id: int, version_id: int, project_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    component, _, _ = _component_context(db, component_id, current_user)
    if project_id is not None and component.project_id != project_id:
        raise NotFoundError('COMPONENT_NOT_FOUND', 'Component not found.', {'component_id': component_id})
    item = component_repository.get_version(db, component_id, version_id)
    if not item:
        raise NotFoundError('COMPONENT_VERSION_NOT_FOUND', 'Component version not found.')
    return item


@router.post('/{component_id}/versions', response_model=ComponentVersionOut)
def save_version(component_id: int, payload: ComponentVersionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner, _ = _component_context(db, component_id, current_user, write=True)
    return create_component_version(db, component_id, payload, owner)


@router.post('/{component_id}/versions/{version_id}/make-current', response_model=ComponentOut)
def make_current(component_id: int, version_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner, _ = _component_context(db, component_id, current_user, write=True)
    return _out(db, set_current_version(db, component_id, version_id, owner))


@router.delete('/{component_id}/versions/{version_id}')
def remove_version(component_id: int, version_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _, owner, _ = _component_context(db, component_id, current_user, write=True)
    delete_component_version(db, component_id, version_id, owner)
    return {'ok': True}


@router.get('/{component_id}/usage')
def usage(component_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    _component_context(db, component_id, current_user)
    return {'component_id': component_id, 'usage_count': usage_count(db, component_id)}


@router.get('/{component_id}/export')
def export(component_id: int, version_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    component, owner, _ = _component_context(db, component_id, current_user)
    return export_component(db, component.id, owner, version_id)


@router.get('/{component_id}/registry')
def registry(component_id: int, project_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_model)):
    component, owner, _ = _component_context(db, component_id, current_user)
    if project_id is not None and component.project_id != project_id:
        raise NotFoundError('COMPONENT_NOT_FOUND', 'Component not found.', {'component_id': component_id})
    component = get_component(db, component_id, owner, component.project_id)
    current = current_version(db, component)
    return component_to_registry_node(component, current) if current else None
