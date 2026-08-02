from app.workflow.validation.service import validate_workflow_graph


def _node(instance_id: str, registry_id: str, params: dict | None = None) -> dict:
    return {"id": instance_id, "type": "mlNode", "data": {"registryId": registry_id, "params": params or {}}}


def test_duplicate_node_ids_are_rejected() -> None:
    graph = {"nodes": [_node("same", "DT-002"), _node("same", "DT-002")], "edges": []}
    result = validate_workflow_graph(graph, require_connections=False)
    assert any(item.type == "duplicate_node_id" for item in result.errors)


def test_unknown_port_handle_is_rejected() -> None:
    graph = {
        "nodes": [_node("source", "DI-002"), _node("target", "IN-001")],
        "edges": [{"id": "edge", "source": "source", "target": "target", "sourceHandle": "missing", "targetHandle": "data"}],
    }
    result = validate_workflow_graph(graph, require_connections=False)
    assert any(item.type == "invalid_output_port" for item in result.errors)


def test_multiple_edges_into_single_port_are_rejected() -> None:
    graph = {
        "nodes": [_node("a", "DI-002"), _node("b", "DI-002"), _node("target", "IN-001")],
        "edges": [
            {"id": "one", "source": "a", "target": "target", "targetHandle": "data"},
            {"id": "two", "source": "b", "target": "target", "targetHandle": "data"},
        ],
    }
    result = validate_workflow_graph(graph, require_connections=False)
    assert any(item.type == "multiple_edges_single_input" for item in result.errors)
