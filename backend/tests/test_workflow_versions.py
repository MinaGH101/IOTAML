from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.domains.workflows.schemas import WorkflowAutosaveIn, WorkflowCreate, WorkflowVersionCreate
from app.domains.workflows.service import autosave_workflow, create_version, create_workflow, delete_workflow, rename_workflow, restore_version
from app.models import Project, Run, Workflow, WorkflowVersion


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def test_autosave_is_noop_for_identical_draft_and_revises_changed_graph() -> None:
    with make_session() as db:
        db.add(Project(id=1, name="Project", owner_username="admin"))
        db.commit()
        graph = {"nodes": [], "edges": [], "meta": {"datasetId": None}}
        workflow = create_workflow(
            db,
            WorkflowCreate(name="Draft", graph=graph, project_id=1, last_run_id=None),
            "admin",
        )
        assert workflow.revision == 1

        unchanged = autosave_workflow(
            db,
            workflow.id,
            WorkflowAutosaveIn(name="Draft", graph=graph, project_id=1, last_run_id=None, base_revision=1),
            "admin",
        )
        assert unchanged.revision == 1

        changed_graph = {"nodes": [], "edges": [], "meta": {"datasetId": None, "targetColumn": "target"}}
        changed = autosave_workflow(
            db,
            workflow.id,
            WorkflowAutosaveIn(name="Draft", graph=changed_graph, project_id=1, last_run_id=None, base_revision=1),
            "admin",
        )
        assert changed.revision == 2
        assert changed.graph == changed_graph


def test_named_versions_are_immutable_snapshots_and_can_be_restored() -> None:
    with make_session() as db:
        db.add(Project(id=1, name="Project", owner_username="admin"))
        db.commit()
        first_graph = {"nodes": [], "edges": [], "meta": {"targetColumn": "a"}}
        workflow = create_workflow(
            db,
            WorkflowCreate(name="Draft", graph=first_graph, project_id=1, last_run_id=None),
            "admin",
        )
        version = create_version(
            db,
            workflow.id,
            WorkflowVersionCreate(name="Baseline", description="Stable baseline", run_id=None),
            "admin",
        )
        assert version.version_number == 1
        assert version.graph == first_graph

        second_graph = {"nodes": [], "edges": [], "meta": {"targetColumn": "b"}}
        workflow = autosave_workflow(
            db,
            workflow.id,
            WorkflowAutosaveIn(name="Draft", graph=second_graph, project_id=1, last_run_id=None, base_revision=1),
            "admin",
        )
        assert workflow.graph == second_graph
        assert version.graph == first_graph

        restored = restore_version(db, workflow.id, version.id, "admin")
        assert restored.graph == first_graph
        assert restored.revision == 3


def test_workflow_can_be_renamed_and_deleted_without_removing_run_history() -> None:
    with make_session() as db:
        db.add(Project(id=1, name="Project", owner_username="admin"))
        db.commit()
        graph = {"nodes": [], "edges": [], "meta": {}}
        workflow = create_workflow(
            db,
            WorkflowCreate(name="Draft", graph=graph, project_id=1, last_run_id=None),
            "admin",
        )
        version = create_version(
            db,
            workflow.id,
            WorkflowVersionCreate(name="Baseline", description="", run_id=None),
            "admin",
        )
        run = Run(
            status="succeeded",
            workflow_name=workflow.name,
            workflow_graph=graph,
            workflow_id=workflow.id,
            workflow_revision=workflow.revision,
            project_id=1,
            owner_username="admin",
        )
        db.add(run)
        db.commit()
        workflow_id = workflow.id
        version_id = version.id
        run_id = run.id

        renamed = rename_workflow(db, workflow_id, "Production Flow", "admin")
        assert renamed.name == "Production Flow"
        assert renamed.revision == 2

        delete_workflow(db, workflow_id, "admin")
        assert db.get(Workflow, workflow_id) is None
        assert db.get(WorkflowVersion, version_id) is None
        preserved_run = db.get(Run, run_id)
        assert preserved_run is not None
        assert preserved_run.workflow_id is None
