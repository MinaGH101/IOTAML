from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.errors import ConflictError
from app.database import Base
from app.domains.components.schemas import ComponentCreate, ComponentImportPackage, ComponentVersionCreate
from app.domains.components.service import (
    component_to_registry_node,
    create_component,
    create_component_version,
    current_version,
    delete_component,
    delete_component_version,
    export_component,
    import_component,
    set_current_version,
    usage_count,
)
from app.models import Project, Workflow


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def component_payload(name: str = "Reusable pass-through") -> ComponentCreate:
    return ComponentCreate(
        name=name,
        description="A typed reusable test component",
        visibility="private",
        semantic_version="1.0.0",
        graph={
            "nodes": [{
                "id": "pass-1",
                "type": "mlNode",
                "position": {"x": 80, "y": 80},
                "data": {"registryId": "UT-002", "params": {}, "label": "Pass Through"},
            }],
            "edges": [],
            "meta": {},
        },
        interface={
            "inputs": [{
                "id": "input", "name": "Input", "type": "any", "required": True,
                "multiple": False, "internal_node_id": "pass-1", "internal_handle": "input",
            }],
            "outputs": [{
                "id": "output", "name": "Output", "type": "any", "required": True,
                "multiple": False, "internal_node_id": "pass-1", "internal_handle": "output",
            }],
        },
        exposed_parameters=[],
        changelog="Initial version",
    )


def test_component_versions_are_immutable_and_registry_is_pinned() -> None:
    with make_session() as db:
        db.add(Project(id=1, name="Project", owner_username="admin"))
        db.commit()
        component = create_component(db, component_payload(), "admin")
        first = current_version(db, component)
        assert first is not None
        first_hash = first.graph_hash

        registry = component_to_registry_node(component, first)
        assert registry["id"] == f"COMP:{component.id}:{first.id}"
        assert registry["template"]["componentSnapshot"]["graph_hash"] == first_hash
        assert registry["inputs"][0]["id"] == "input"
        assert registry["outputs"][0]["id"] == "output"

        second = create_component_version(
            db,
            component.id,
            ComponentVersionCreate(
                semantic_version="1.1.0",
                graph={**first.graph, "meta": {"revision": 2}},
                interface=first.interface_json,
                exposed_parameters=first.exposed_parameters,
                changelog="Second immutable version",
            ),
            "admin",
        )
        db.refresh(first)
        assert first.graph_hash == first_hash
        assert second.id != first.id
        assert second.version_number == 2
        assert component.current_version_id == second.id

        with pytest.raises(ConflictError):
            delete_component_version(db, component.id, second.id, "admin")

        set_current_version(db, component.id, first.id, "admin")
        delete_component_version(db, component.id, second.id, "admin")
        assert db.get(type(second), second.id) is None


def test_component_usage_prevents_destructive_delete() -> None:
    with make_session() as db:
        db.add(Project(id=1, name="Project", owner_username="admin"))
        db.commit()
        component = create_component(db, component_payload(), "admin")
        version = current_version(db, component)
        assert version is not None
        db.add(Workflow(
            name="Workflow using component",
            graph={
                "nodes": [{"id": "component-1", "type": "mlNode", "data": {"registryId": f"COMP:{component.id}:{version.id}"}}],
                "edges": [],
                "meta": {},
            },
            project_id=1,
            owner_username="admin",
        ))
        db.commit()
        assert usage_count(db, component.id) == 1
        with pytest.raises(ConflictError):
            delete_component(db, component.id, "admin")


def test_component_export_import_round_trip() -> None:
    with make_session() as db:
        db.add(Project(id=1, name="Project", owner_username="admin"))
        db.commit()
        original = create_component(db, component_payload("Original component"), "admin")
        package = export_component(db, original.id, "admin")
        assert package["format"] == "iota-workflow-component-v1"
        imported = import_component(db, ComponentImportPackage.model_validate(package), "admin")
        imported_version = current_version(db, imported)
        original_version = current_version(db, original)
        assert imported.id != original.id
        assert imported.name == original.name
        assert imported.visibility == "private"
        assert imported_version is not None and original_version is not None
        assert imported_version.graph_hash == original_version.graph_hash
        assert imported_version.interface_json == original_version.interface_json


def test_component_executes_as_a_real_node_with_namespaced_internal_statuses() -> None:
    from app.workflow.executor import execute_scientific_workflow

    snapshot = {
        "component_id": 1,
        "component_name": "JSON component",
        "version_id": 1,
        "version_number": 1,
        "semantic_version": "1.0.0",
        "graph_hash": "test-hash",
        "graph": {
            "nodes": [{
                "id": "json-1",
                "type": "mlNode",
                "data": {"registryId": "DI-001", "params": {"json_payload": [{"json": {"value": 7}}]}},
            }],
            "edges": [],
            "meta": {},
        },
        "interface": {
            "inputs": [],
            "outputs": [{
                "id": "items", "name": "Items", "type": "json_items", "required": True,
                "multiple": False, "internal_node_id": "json-1", "internal_handle": "json_items",
            }],
        },
        "exposed_parameters": [],
        "dependencies": [],
    }
    graph = {
        "nodes": [{
            "id": "component-1",
            "type": "mlNode",
            "data": {
                "registryId": "COMP:1:1",
                "label": "JSON component",
                "params": {},
                "componentSnapshot": snapshot,
            },
        }],
        "edges": [],
        "meta": {},
    }
    statuses: list[tuple[str, str]] = []

    result = execute_scientific_workflow(
        graph,
        dataset_id=None,
        target_column=None,
        task_type="auto",
        project_id=1,
        execution_id="component-test",
        progress_callback=lambda node_id, status, *_args, **_kwargs: statuses.append((node_id, status)),
    )

    assert result["error"] is None
    assert result["artifacts"]["node_outputs"]["component-1"] == [{"json": {"value": 7}}]
    assert ("component-1::json-1", "running") in statuses
    assert ("component-1::json-1", "succeeded") in statuses


def test_nested_component_package_includes_and_remaps_dependencies() -> None:
    with make_session() as db:
        db.add(Project(id=1, name="Project", owner_username="admin"))
        db.commit()
        child = create_component(db, component_payload("Nested child"), "admin")
        child_version = current_version(db, child)
        assert child_version is not None
        child_registry = component_to_registry_node(child, child_version)
        parent_payload = ComponentCreate(
            name="Parent component",
            description="Contains another reusable component",
            visibility="private",
            semantic_version="1.0.0",
            graph={
                "nodes": [{
                    "id": "child-instance",
                    "type": "mlNode",
                    "data": {
                        "registryId": child_registry["id"],
                        "params": {},
                        "componentSnapshot": child_registry["template"]["componentSnapshot"],
                    },
                }],
                "edges": [],
                "meta": {},
            },
            interface={
                "inputs": [{
                    "id": "input", "name": "Input", "type": "any", "required": True,
                    "multiple": False, "internal_node_id": "child-instance", "internal_handle": "input",
                }],
                "outputs": [{
                    "id": "output", "name": "Output", "type": "any", "required": True,
                    "multiple": False, "internal_node_id": "child-instance", "internal_handle": "output",
                }],
            },
            exposed_parameters=[],
            changelog="Initial nested component",
        )
        parent = create_component(db, parent_payload, "admin")
        package = export_component(db, parent.id, "admin")
        assert len(package["dependencies"]) == 1

        imported_parent = import_component(db, ComponentImportPackage.model_validate(package), "admin")
        imported_parent_version = current_version(db, imported_parent)
        assert imported_parent_version is not None
        imported_node = imported_parent_version.graph["nodes"][0]
        assert imported_node["data"]["registryId"] != child_registry["id"]
        imported_snapshot = imported_node["data"]["componentSnapshot"]
        assert imported_snapshot["component_name"] == "Nested child"
        assert imported_snapshot["version_id"] != child_version.id


def test_project_scoped_component_is_not_visible_in_another_project() -> None:
    from app.core.errors import NotFoundError
    from app.domains.components.service import get_component, list_components

    with make_session() as db:
        db.add_all([
            Project(id=1, name="Project one", owner_username="admin"),
            Project(id=2, name="Project two", owner_username="admin"),
        ])
        db.commit()
        payload = component_payload("Project-only component").model_copy(update={"visibility": "project", "project_id": 1})
        component = create_component(db, payload, "admin")
        assert component in list_components(db, "admin", project_id=1)
        assert component not in list_components(db, "admin", project_id=2)
        with pytest.raises(NotFoundError):
            get_component(db, component.id, "admin", project_id=2)
