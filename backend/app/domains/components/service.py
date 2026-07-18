from __future__ import annotations

import copy
import re
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationAppError
from app.domains.components.repository import component_repository
from app.domains.components.schemas import ComponentCreate, ComponentImportPackage, ComponentUpdate, ComponentVersionCreate
from app.models import Project, Workflow, WorkflowComponent, WorkflowComponentVersion, WorkflowVersion
from app.services.node_cache_keys import sha256_json
from app.workflow.validator import validate_workflow_graph

COMPONENT_REGISTRY_PREFIX = "COMP"


def component_registry_id(component_id: int, version_id: int) -> str:
    return f"{COMPONENT_REGISTRY_PREFIX}:{component_id}:{version_id}"


def parse_component_registry_id(value: str) -> tuple[int, int] | None:
    match = re.fullmatch(r"COMP:(\d+):(\d+)", str(value))
    return (int(match.group(1)), int(match.group(2))) if match else None


def _assert_scope(db: Session, visibility: str, project_id: int | None, owner: str) -> None:
    if visibility == "project":
        if project_id is None:
            raise ValidationAppError("COMPONENT_PROJECT_REQUIRED", "Project visibility requires a project.")
        project = db.get(Project, project_id)
        if not project or project.owner_username != owner:
            raise PermissionDeniedError()


def _node_ids(graph: dict) -> set[str]:
    return {str(node.get("id")) for node in graph.get("nodes") or []}


def _validate_component_definition(graph: dict, interface: dict, exposed: list[dict]) -> None:
    result = validate_workflow_graph(graph, component_interface=interface)
    if not result.valid:
        raise ValidationAppError(
            "COMPONENT_GRAPH_INVALID",
            "Component graph validation failed.",
            {"errors": [error.model_dump() for error in result.errors]},
        )
    ids = _node_ids(graph)
    for side in ("inputs", "outputs"):
        for port in interface.get(side) or []:
            if str(port.get("internal_node_id")) not in ids:
                raise ValidationAppError("COMPONENT_PORT_TARGET_MISSING", f"Component {side[:-1]} port targets a missing internal node.")
    seen: set[tuple[str, str]] = set()
    for parameter in exposed:
        key = (str(parameter.get("internal_node_id")), str(parameter.get("internal_param")))
        if key[0] not in ids:
            raise ValidationAppError("COMPONENT_PARAMETER_TARGET_MISSING", "An exposed parameter targets a missing internal node.")
        if key in seen:
            raise ValidationAppError("COMPONENT_PARAMETER_DUPLICATE", "The same internal parameter cannot be exposed twice.")
        seen.add(key)


def _dependencies(graph: dict) -> list[dict[str, Any]]:
    dependencies: dict[tuple[int, int], dict[str, Any]] = {}
    for node in graph.get("nodes") or []:
        data = node.get("data") or {}
        parsed = parse_component_registry_id(str(data.get("registryId") or ""))
        if parsed:
            component_id, version_id = parsed
            dependencies[(component_id, version_id)] = {"component_id": component_id, "version_id": version_id}
    return list(dependencies.values())



def _assert_dependencies_valid(db: Session, component_id: int, dependencies: list[dict[str, Any]]) -> None:
    for dependency in dependencies:
        dependency_component_id = int(dependency["component_id"])
        dependency_version_id = int(dependency["version_id"])
        if dependency_component_id == component_id:
            raise ValidationAppError("COMPONENT_DEPENDENCY_CYCLE", "A component cannot contain itself.")
        dependency_version = component_repository.get_version(db, dependency_component_id, dependency_version_id)
        if not dependency_version:
            raise ValidationAppError(
                "COMPONENT_DEPENDENCY_MISSING",
                "A nested component version is missing or was not imported.",
                {"component_id": dependency_component_id, "version_id": dependency_version_id},
            )

    visited: set[int] = set()

    def reaches_target(version_id: int) -> bool:
        if version_id in visited:
            return False
        visited.add(version_id)
        version = db.get(WorkflowComponentVersion, version_id)
        if not version:
            return False
        for nested in version.dependencies_json or []:
            nested_component_id = int(nested.get("component_id") or 0)
            nested_version_id = int(nested.get("version_id") or 0)
            if nested_component_id == component_id or reaches_target(nested_version_id):
                return True
        return False

    for dependency in dependencies:
        if reaches_target(int(dependency["version_id"])):
            raise ValidationAppError("COMPONENT_DEPENDENCY_CYCLE", "Nested components would create a dependency cycle.")


def _accessible_project_id(db: Session, owner: str, project_id: int | None) -> int | None:
    if project_id is None:
        return None
    project = db.get(Project, project_id)
    return project_id if project and project.owner_username == owner else None


def _usage_in_graph(graph: dict, component_id: int, version_id: int | None = None) -> int:
    count = 0
    for node in graph.get("nodes") or []:
        parsed = parse_component_registry_id(str((node.get("data") or {}).get("registryId") or ""))
        if parsed and parsed[0] == component_id and (version_id is None or parsed[1] == version_id):
            count += 1
    return count


def usage_count(db: Session, component_id: int, version_id: int | None = None) -> int:
    total = 0
    for graph, in db.query(Workflow.graph).all():
        total += _usage_in_graph(graph or {}, component_id, version_id)
    for graph, in db.query(WorkflowVersion.graph).all():
        total += _usage_in_graph(graph or {}, component_id, version_id)
    for graph, in db.query(WorkflowComponentVersion.graph).all():
        total += _usage_in_graph(graph or {}, component_id, version_id)
    return total


def _version_snapshot(component: WorkflowComponent, version: WorkflowComponentVersion) -> dict[str, Any]:
    return {
        "component_id": component.id,
        "component_name": component.name,
        "version_id": version.id,
        "version_number": version.version_number,
        "semantic_version": version.semantic_version,
        "graph_hash": version.graph_hash,
        "graph": copy.deepcopy(version.graph),
        "interface": copy.deepcopy(version.interface_json),
        "exposed_parameters": copy.deepcopy(version.exposed_parameters),
        "dependencies": copy.deepcopy(version.dependencies_json),
    }


def component_to_registry_node(component: WorkflowComponent, version: WorkflowComponentVersion) -> dict[str, Any]:
    interface = version.interface_json or {}
    params = []
    for item in version.exposed_parameters or []:
        params.append({
            "name": item["id"],
            "label": item["name"],
            "type": item.get("type", "text"),
            "default": item.get("default"),
            "required": bool(item.get("required")),
            "options": item.get("options") or [],
            "supportsDynamic": True,
            "help": item.get("description", ""),
        })
    def port(item: dict, side: str) -> dict:
        return {
            "id": item["id"], "name": item["name"], "type": item.get("type", "any"),
            "required": bool(item.get("required", side == "inputs")), "multiple": bool(item.get("multiple", False)),
        }
    return {
        "id": component_registry_id(component.id, version.id),
        "type": "workflow_component",
        "name": component.name,
        "label": component.name,
        "category": "Components",
        "description": component.description or f"Reusable component {version.semantic_version}",
        "inputs": [port(item, "inputs") for item in interface.get("inputs") or []],
        "outputs": [port(item, "outputs") for item in interface.get("outputs") or []],
        "settingsSchema": params,
        "params": params,
        "executionMode": "queued",
        "supportsDynamicParameters": True,
        "implemented": True,
        "comingSoon": False,
        "priority": "Reusable",
        "validationRules": "Pinned immutable component version",
        "cacheable": True,
        "cacheVersion": version.graph_hash[:16],
        "isComponent": True,
        "componentId": component.id,
        "componentVersionId": version.id,
        "componentVersion": version.semantic_version,
        "template": {"componentSnapshot": _version_snapshot(component, version)},
    }


def create_component(db: Session, payload: ComponentCreate, owner: str, *, commit: bool = True) -> WorkflowComponent:
    _assert_scope(db, payload.visibility, payload.project_id, owner)
    interface = payload.interface.model_dump()
    exposed = [item.model_dump() for item in payload.exposed_parameters]
    _validate_component_definition(payload.graph, interface, exposed)
    component = WorkflowComponent(
        name=payload.name.strip(), description=payload.description.strip(), category=payload.category.strip(),
        icon=payload.icon, visibility=payload.visibility, project_id=payload.project_id, owner_username=owner,
    )
    db.add(component)
    db.flush()
    dependencies = _dependencies(payload.graph)
    _assert_dependencies_valid(db, component.id, dependencies)
    version = WorkflowComponentVersion(
        component_id=component.id, version_number=1, semantic_version=payload.semantic_version,
        name=component.name, description=component.description, graph=payload.graph,
        graph_hash=sha256_json({"graph": payload.graph, "interface": interface, "exposed": exposed}),
        interface_json=interface, exposed_parameters=exposed, dependencies_json=dependencies,
        changelog=payload.changelog.strip(), owner_username=owner,
    )
    db.add(version)
    db.flush()
    component.current_version_id = version.id
    if commit:
        db.commit()
        db.refresh(component)
    else:
        db.flush()
    return component


def list_components(db: Session, owner: str, project_id: int | None = None, include_archived: bool = False):
    return component_repository.list_accessible(db, owner, _accessible_project_id(db, owner, project_id), include_archived)


def get_component(db: Session, component_id: int, owner: str, project_id: int | None = None):
    component = component_repository.get_accessible(db, component_id, owner, _accessible_project_id(db, owner, project_id))
    if not component:
        raise NotFoundError("COMPONENT_NOT_FOUND", "Component not found.", {"component_id": component_id})
    return component


def get_owned_component(db: Session, component_id: int, owner: str):
    component = component_repository.get_owned(db, component_id, owner)
    if not component:
        raise NotFoundError("COMPONENT_NOT_FOUND", "Component not found.", {"component_id": component_id})
    return component


def current_version(db: Session, component: WorkflowComponent):
    return db.get(WorkflowComponentVersion, component.current_version_id) if component.current_version_id else None


def create_component_version(db: Session, component_id: int, payload: ComponentVersionCreate, owner: str):
    component = get_owned_component(db, component_id, owner)
    interface = payload.interface.model_dump()
    exposed = [item.model_dump() for item in payload.exposed_parameters]
    _validate_component_definition(payload.graph, interface, exposed)
    duplicate = db.query(WorkflowComponentVersion).filter(
        WorkflowComponentVersion.component_id == component_id,
        WorkflowComponentVersion.semantic_version == payload.semantic_version,
    ).first()
    if duplicate:
        raise ConflictError("COMPONENT_VERSION_EXISTS", "This semantic version already exists.")
    dependencies = _dependencies(payload.graph)
    _assert_dependencies_valid(db, component.id, dependencies)
    number = int(db.query(func.coalesce(func.max(WorkflowComponentVersion.version_number), 0)).filter(
        WorkflowComponentVersion.component_id == component_id
    ).scalar() or 0) + 1
    version = WorkflowComponentVersion(
        component_id=component.id, version_number=number, semantic_version=payload.semantic_version,
        name=component.name, description=component.description, graph=payload.graph,
        graph_hash=sha256_json({"graph": payload.graph, "interface": interface, "exposed": exposed}),
        interface_json=interface, exposed_parameters=exposed, dependencies_json=dependencies,
        changelog=payload.changelog.strip(), owner_username=owner,
    )
    db.add(version)
    db.flush()
    component.current_version_id = version.id
    db.commit()
    db.refresh(version)
    return version


def update_component(db: Session, component_id: int, payload: ComponentUpdate, owner: str):
    component = get_owned_component(db, component_id, owner)
    data = payload.model_dump(exclude_unset=True)
    visibility = data.get("visibility", component.visibility)
    project_id = data.get("project_id", component.project_id)
    _assert_scope(db, visibility, project_id, owner)
    for key, value in data.items():
        setattr(component, key, value.strip() if isinstance(value, str) else value)
    db.commit(); db.refresh(component)
    return component


def delete_component_version(db: Session, component_id: int, version_id: int, owner: str):
    component = get_owned_component(db, component_id, owner)
    version = component_repository.get_version(db, component_id, version_id)
    if not version:
        raise NotFoundError("COMPONENT_VERSION_NOT_FOUND", "Component version not found.")
    if component.current_version_id == version_id:
        raise ConflictError("COMPONENT_CURRENT_VERSION", "The current component version cannot be deleted. Select another current version first.")
    count = usage_count(db, component_id, version_id)
    if count:
        raise ConflictError("COMPONENT_VERSION_IN_USE", "This component version is used by workflows or other components.", {"usage_count": count})
    db.delete(version); db.commit()


def set_current_version(db: Session, component_id: int, version_id: int, owner: str):
    component = get_owned_component(db, component_id, owner)
    version = component_repository.get_version(db, component_id, version_id)
    if not version:
        raise NotFoundError("COMPONENT_VERSION_NOT_FOUND", "Component version not found.")
    component.current_version_id = version.id
    db.commit(); db.refresh(component)
    return component


def delete_component(db: Session, component_id: int, owner: str):
    component = get_owned_component(db, component_id, owner)
    count = usage_count(db, component_id)
    if count:
        raise ConflictError("COMPONENT_IN_USE", "Archive this component instead; it is used by workflows.", {"usage_count": count})
    for version in component_repository.list_versions(db, component_id):
        db.delete(version)
    db.delete(component); db.commit()


def _portable_entry(component: WorkflowComponent, version: WorkflowComponentVersion) -> dict[str, Any]:
    return {
        "source_component_id": component.id,
        "source_version_id": version.id,
        "component": {
            "name": component.name,
            "description": component.description,
            "category": component.category,
            "icon": component.icon,
            "visibility": "private",
        },
        "version": {
            "semantic_version": version.semantic_version,
            "graph": copy.deepcopy(version.graph),
            "interface": copy.deepcopy(version.interface_json),
            "exposed_parameters": copy.deepcopy(version.exposed_parameters),
            "changelog": version.changelog,
            "graph_hash": version.graph_hash,
        },
    }


def export_component(db: Session, component_id: int, owner: str, version_id: int | None = None) -> dict:
    component = get_component(db, component_id, owner)
    version = component_repository.get_version(db, component_id, version_id) if version_id else current_version(db, component)
    if not version:
        raise NotFoundError("COMPONENT_VERSION_NOT_FOUND", "Component version not found.")

    dependencies: list[dict[str, Any]] = []
    visited: set[tuple[int, int]] = set()

    def collect(item: WorkflowComponentVersion) -> None:
        for dependency in item.dependencies_json or []:
            key = (int(dependency.get("component_id") or 0), int(dependency.get("version_id") or 0))
            if key in visited:
                continue
            dependency_component = db.get(WorkflowComponent, key[0])
            dependency_version = component_repository.get_version(db, key[0], key[1])
            if not dependency_component or not dependency_version:
                raise ValidationAppError(
                    "COMPONENT_DEPENDENCY_MISSING",
                    "A nested dependency is missing and the component cannot be exported safely.",
                    {"component_id": key[0], "version_id": key[1]},
                )
            visited.add(key)
            collect(dependency_version)
            dependencies.append(_portable_entry(dependency_component, dependency_version))

    collect(version)
    root = _portable_entry(component, version)
    return {
        "format": "iota-workflow-component-v1",
        "component": root["component"],
        "version": root["version"],
        "source_component_id": root["source_component_id"],
        "source_version_id": root["source_version_id"],
        "dependencies": dependencies,
    }


def _rewrite_imported_graph(db: Session, graph: dict, mapping: dict[tuple[int, int], tuple[WorkflowComponent, WorkflowComponentVersion]]) -> dict:
    rewritten = copy.deepcopy(graph)
    for node in rewritten.get("nodes") or []:
        data = dict(node.get("data") or {})
        parsed = parse_component_registry_id(str(data.get("registryId") or ""))
        if not parsed:
            node["data"] = data
            continue
        replacement = mapping.get(parsed)
        if not replacement:
            # Backward-compatible packages without bundled dependencies may
            # reference a dependency already installed in this deployment.
            existing_component = db.get(WorkflowComponent, parsed[0])
            existing_version = component_repository.get_version(db, parsed[0], parsed[1])
            if not existing_component or not existing_version:
                raise ValidationAppError(
                    "COMPONENT_IMPORT_DEPENDENCY_MISSING",
                    "The package is missing a nested component dependency.",
                    {"component_id": parsed[0], "version_id": parsed[1]},
                )
            replacement = (existing_component, existing_version)
        replacement_component, replacement_version = replacement
        data["registryId"] = component_registry_id(replacement_component.id, replacement_version.id)
        data["catalogId"] = data["registryId"]
        data["componentId"] = replacement_component.id
        data["componentVersionId"] = replacement_version.id
        data["componentVersion"] = replacement_version.semantic_version
        data["componentSnapshot"] = _version_snapshot(replacement_component, replacement_version)
        node["data"] = data
    return rewritten


def _import_portable_entry(
    db: Session,
    entry: dict[str, Any],
    owner: str,
    mapping: dict[tuple[int, int], tuple[WorkflowComponent, WorkflowComponentVersion]],
) -> tuple[WorkflowComponent, WorkflowComponentVersion]:
    component_data = entry.get("component") or {}
    version_data = entry.get("version") or {}
    rewritten_graph = _rewrite_imported_graph(db, version_data.get("graph") or {}, mapping)
    payload = ComponentCreate(
        name=str(component_data.get("name") or "Imported component"),
        description=str(component_data.get("description") or ""),
        category=str(component_data.get("category") or "Components"),
        icon=str(component_data.get("icon") or "workflow"),
        visibility="private",
        semantic_version=str(version_data.get("semantic_version") or "1.0.0"),
        graph=rewritten_graph,
        interface=version_data.get("interface") or {},
        exposed_parameters=version_data.get("exposed_parameters") or [],
        changelog=str(version_data.get("changelog") or "Imported component"),
    )
    created = create_component(db, payload, owner, commit=False)
    created_version = current_version(db, created)
    if not created_version:
        raise RuntimeError("Imported component version was not created.")
    source_key = (int(entry.get("source_component_id") or 0), int(entry.get("source_version_id") or 0))
    if all(source_key):
        mapping[source_key] = (created, created_version)
    return created, created_version


def import_component(db: Session, package: ComponentImportPackage, owner: str) -> WorkflowComponent:
    mapping: dict[tuple[int, int], tuple[WorkflowComponent, WorkflowComponentVersion]] = {}
    try:
        for dependency in package.dependencies:
            _import_portable_entry(db, dependency, owner, mapping)
        root_entry = {
            "source_component_id": package.source_component_id,
            "source_version_id": package.source_version_id,
            "component": package.component,
            "version": package.version,
        }
        root, _ = _import_portable_entry(db, root_entry, owner, mapping)
        db.commit()
        db.refresh(root)
        return root
    except Exception:
        db.rollback()
        raise
