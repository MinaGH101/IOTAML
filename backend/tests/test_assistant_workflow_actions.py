"""Regression tests for assistant workflow graph actions."""

import pytest

from app.domains.assistant.workflow_actions import (
    WorkflowActionError,
    apply_workflow_actions_to_graph,
)


def _operation(action: str, **values: object) -> dict[str, object]:
    operation: dict[str, object] = {
        "action": action,
        "client_id": None,
        "node_id": None,
        "registry_id": None,
        "label": None,
        "params": None,
        "position": None,
        "after_node_id": None,
        "before_node_id": None,
        "source_node_id": None,
        "target_node_id": None,
        "source_handle": None,
        "target_handle": None,
        "output_handle": None,
        "downstream_handle": None,
        "edge_id": None,
    }
    operation.update(values)
    return operation


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


def test_insert_node_after_csv_appends_and_selects_dataframe_ports() -> None:
    graph = {"nodes": [], "edges": []}

    updated = apply_workflow_actions_to_graph(
        graph,
        [
            _operation("add_node", client_id="csv", registry_id="DI-002"),
            _operation(
                "insert_node",
                client_id="detection_limit",
                registry_id="CL-010",
                after_node_id="Node 1",
            ),
        ],
    )

    csv, detection_limit = updated["nodes"]
    assert updated["edges"] == [
        {
            "id": f"e-{csv['id']}-dataframe-{detection_limit['id']}-data",
            "source": csv["id"],
            "target": detection_limit["id"],
            "sourceHandle": "dataframe",
            "targetHandle": "data",
            "animated": True,
        }
    ]


def test_insert_node_splices_a_single_downstream_connection() -> None:
    initial = apply_workflow_actions_to_graph(
        {"nodes": [], "edges": []},
        [
            _operation("add_node", client_id="csv", registry_id="DI-002"),
            _operation("add_node", client_id="histogram", registry_id="VZ-002"),
            _operation("connect", source_node_id="csv", target_node_id="histogram"),
        ],
    )
    initial.pop("_assistantActionSummary")

    updated = apply_workflow_actions_to_graph(
        initial,
        [_operation("insert_node", registry_id="CL-010", after_node_id="نود 1")],
    )

    csv, histogram, detection_limit = updated["nodes"]
    assert {(edge["source"], edge["target"]) for edge in updated["edges"]} == {
        (csv["id"], detection_limit["id"]),
        (detection_limit["id"], histogram["id"]),
    }
    assert updated["_assistantActionSummary"][0]["replacedEdgeId"]


def test_requested_unknown_port_is_not_reported_as_incompatible() -> None:
    graph = {"nodes": [], "edges": []}

    with pytest.raises(WorkflowActionError) as exc_info:
        apply_workflow_actions_to_graph(
            graph,
            [
                _operation("add_node", client_id="csv", registry_id="DI-002"),
                _operation("add_node", client_id="detection_limit", registry_id="CL-010"),
                _operation(
                    "connect",
                    source_node_id="csv",
                    target_node_id="detection_limit",
                    target_handle="dataframe",
                ),
            ],
        )

    assert exc_info.value.code == "UNKNOWN_PORT"
    assert exc_info.value.details["availablePorts"] == [
        {"id": "data", "name": "DataFrame", "type": "dataframe"}
    ]


def test_insert_after_a_branch_requires_a_downstream_choice() -> None:
    initial = apply_workflow_actions_to_graph(
        {"nodes": [], "edges": []},
        [
            _operation("add_node", client_id="csv", registry_id="DI-002"),
            _operation("add_node", client_id="left", registry_id="VZ-002"),
            _operation("add_node", client_id="right", registry_id="VZ-002"),
            _operation("connect", source_node_id="csv", target_node_id="left"),
            _operation("connect", source_node_id="csv", target_node_id="right"),
        ],
    )
    initial.pop("_assistantActionSummary")

    with pytest.raises(WorkflowActionError) as exc_info:
        apply_workflow_actions_to_graph(
            initial,
            [_operation("insert_node", registry_id="CL-010", after_node_id="Node 1")],
        )

    assert exc_info.value.code == "AMBIGUOUS_INSERT_PATH"
    assert len(initial["nodes"]) == 3
    assert len(initial["edges"]) == 2


def test_remove_node_accepts_the_visible_node_reference() -> None:
    initial = apply_workflow_actions_to_graph(
        {"nodes": [], "edges": []},
        [
            _operation("add_node", client_id="csv", registry_id="DI-002"),
            _operation("add_node", client_id="histogram", registry_id="VZ-002"),
            _operation("connect", source_node_id="csv", target_node_id="histogram"),
        ],
    )
    initial.pop("_assistantActionSummary")

    updated = apply_workflow_actions_to_graph(
        initial,
        [_operation("remove_node", node_id="Node 2")],
    )

    assert len(updated["nodes"]) == 1
    assert updated["edges"] == []
    assert updated["_assistantActionSummary"] == [
        {"action": "remove_node", "nodeId": initial["nodes"][1]["id"], "removedEdges": 1}
    ]
