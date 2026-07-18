from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.domains.components.repository import component_repository
from app.domains.components.schemas import (
    ComponentCreate, ComponentImportPackage, ComponentOut, ComponentUpdate,
    ComponentVersionCreate, ComponentVersionOut, ComponentVersionSummaryOut,
)
from app.domains.components.service import (
    component_to_registry_node, create_component, create_component_version, current_version,
    delete_component, delete_component_version, export_component, get_component, get_owned_component,
    import_component, list_components, set_current_version, update_component, usage_count,
)
from app.services.users import get_current_user

router = APIRouter(prefix="/components", tags=["components"])


def _out(db: Session, component) -> dict:
    version = current_version(db, component)
    return {
        **{column.name: getattr(component, column.name) for column in component.__table__.columns},
        "current_version": version,
        "usage_count": usage_count(db, component.id),
    }


@router.get("", response_model=list[ComponentOut])
def list_all(project_id: int | None = None, include_archived: bool = False, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    owner = str(current_user["username"])
    return [_out(db, item) for item in list_components(db, owner, project_id, include_archived)]


@router.post("", response_model=ComponentOut)
def create(payload: ComponentCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    component = create_component(db, payload, str(current_user["username"]))
    return _out(db, component)


@router.post("/import", response_model=ComponentOut)
def import_package(payload: ComponentImportPackage, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return _out(db, import_component(db, payload, str(current_user["username"])))


@router.get("/{component_id}", response_model=ComponentOut)
def get_one(component_id: int, project_id: int | None = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return _out(db, get_component(db, component_id, str(current_user["username"]), project_id))


@router.patch("/{component_id}", response_model=ComponentOut)
def update(component_id: int, payload: ComponentUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return _out(db, update_component(db, component_id, payload, str(current_user["username"])))


@router.delete("/{component_id}")
def remove(component_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    delete_component(db, component_id, str(current_user["username"]))
    return {"ok": True}


@router.get("/{component_id}/versions", response_model=list[ComponentVersionSummaryOut])
def versions(component_id: int, project_id: int | None = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    get_component(db, component_id, str(current_user["username"]), project_id)
    return component_repository.list_versions(db, component_id)


@router.get("/{component_id}/versions/{version_id}", response_model=ComponentVersionOut)
def version(component_id: int, version_id: int, project_id: int | None = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    get_component(db, component_id, str(current_user["username"]), project_id)
    item = component_repository.get_version(db, component_id, version_id)
    if not item:
        from app.core.errors import NotFoundError
        raise NotFoundError("COMPONENT_VERSION_NOT_FOUND", "Component version not found.")
    return item


@router.post("/{component_id}/versions", response_model=ComponentVersionOut)
def save_version(component_id: int, payload: ComponentVersionCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return create_component_version(db, component_id, payload, str(current_user["username"]))


@router.post("/{component_id}/versions/{version_id}/make-current", response_model=ComponentOut)
def make_current(component_id: int, version_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return _out(db, set_current_version(db, component_id, version_id, str(current_user["username"])))


@router.delete("/{component_id}/versions/{version_id}")
def remove_version(component_id: int, version_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    delete_component_version(db, component_id, version_id, str(current_user["username"]))
    return {"ok": True}


@router.get("/{component_id}/usage")
def usage(component_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    get_owned_component(db, component_id, str(current_user["username"]))
    return {"component_id": component_id, "usage_count": usage_count(db, component_id)}


@router.get("/{component_id}/export")
def export(component_id: int, version_id: int | None = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return export_component(db, component_id, str(current_user["username"]), version_id)


@router.get("/{component_id}/registry")
def registry(component_id: int, project_id: int | None = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    component = get_component(db, component_id, str(current_user["username"]), project_id)
    version = current_version(db, component)
    return component_to_registry_node(component, version) if version else None
