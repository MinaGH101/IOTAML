"""Regression tests for assistant workflow graph actions."""

import pytest

from app.domains.assistant.workflow_actions import (
    WorkflowActionError,
    apply_workflow_actions_to_graph,
)


def test_workflow_action_batch_adds_and_connects_nodes() -> None:
    graph = {"nodes": [], "edges": [], "meta": {"targetColumn": "target"}}

    updated = apply_workflow_actions_to_graph(
        graph,
        [
            {
                "action": "add_node",
                "client_id": "source",
                "registry_id": "DI-002",
                "label": "Data source",
                "params": None,
                "position": {"x": 100, "y": 100},
            },
            {
                "action": "add_node",
                "client_id": "hist",
                "registry_id": "VZ-002",
                "label": "Histogram",
                "params": None,
                "after_node_id": "source",
            },
            {
                "action": "connect",
                "source_node_id": "source",
                "target_node_id": "hist",
                "source_handle": None,
                "target_handle": None,
            },
        ],
    )

    assert len(updated["nodes"]) == 2
    assert len(updated["edges"]) == 1
    assert updated["edges"][0]["source"] == updated["nodes"][0]["id"]
    assert updated["edges"][0]["target"] == updated["nodes"][1]["id"]


def test_workflow_action_batch_fails_without_mutating_original_graph() -> None:
    graph = {"nodes": [], "edges": []}

    with pytest.raises(WorkflowActionError):
        apply_workflow_actions_to_graph(
            graph,
            [
                {
                    "action": "add_node",
                    "client_id": "hist",
                    "registry_id": "VZ-002",
                    "label": "Histogram",
                },
                {
                    "action": "connect",
                    "source_node_id": "missing",
                    "target_node_id": "hist",
                },
            ],
        )

    assert graph == {"nodes": [], "edges": []}
