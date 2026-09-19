"""Regression tests for assistant-created workflow runs."""

from types import SimpleNamespace

from app.domains.assistant import workflow_execution


def test_run_current_workflow_queues_the_saved_authoritative_graph(monkeypatch) -> None:
    graph = {
        "nodes": [{"id": "source"}],
        "edges": [],
        "meta": {"datasetId": 12, "targetColumn": "label", "taskType": "classification"},
    }
    workflow = SimpleNamespace(id=9, name="Saved flow", graph=graph, revision=4, project_id=7)
    captured = {}

    monkeypatch.setattr(workflow_execution, "get_workflow", lambda *_args: workflow)

    def fake_create_run(payload, **kwargs):
        captured["payload"] = payload
        captured["kwargs"] = kwargs
        return SimpleNamespace(id=33, status="queued", progress={"nodes_total": 1})

    monkeypatch.setattr(workflow_execution, "create_run", fake_create_run)
    current_user = object()

    result = workflow_execution.run_current_workflow(
        db=object(),
        workflow_id=9,
        owner_username="owner",
        current_user=current_user,
    )

    assert result == {
        "created": True,
        "runId": 33,
        "status": "queued",
        "nodesTotal": 1,
        "message": "Run was created and queued. Completion has not been confirmed.",
    }
    assert captured["payload"].workflow_graph == graph
    assert captured["payload"].workflow_id == 9
    assert captured["payload"].workflow_revision == 4
    assert captured["payload"].dataset_id == 12
    assert captured["payload"].project_id == 7
    assert captured["payload"].target_column == "label"
    assert captured["payload"].task_type == "classification"
    assert captured["kwargs"]["current_user"] is current_user
