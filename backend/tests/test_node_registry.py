"""Regression and contract tests for node registry."""

from app.nodes.registry import (
    CATALOG_VERSION,
    LEGACY_NODE_ALIASES,
    PORT_COMPATIBILITY,
    all_node_runners,
    canonical_node_id,
    validate_registry_integrity,
)


def test_registry_integrity() -> None:
    validate_registry_integrity()


def test_all_aliases_resolve_to_registered_nodes() -> None:
    registered = {node.id for node in all_node_runners()}
    assert all(canonical_node_id(alias) in registered for alias in LEGACY_NODE_ALIASES)


def test_port_compatibility_is_complete() -> None:
    assert 'any' in PORT_COMPATIBILITY
    assert all(source in PORT_COMPATIBILITY[source] for source in PORT_COMPATIBILITY)


def test_requested_dataframe_nodes_are_in_the_live_catalog() -> None:
    registered = {node.id: node for node in all_node_runners()}
    assert CATALOG_VERSION >= 4
    assert registered["UT-003"].name == "Combine DataFrames"
    assert registered["UT-003"].category == "Data Cleaning"
    assert registered["UT-003"].inputs[0].multiple is True
    assert registered["UT-008"].name == "Interactive Table"
    assert registered["UT-008"].category == "Data Cleaning"
    assert registered["UT-008"].cache_version == "2"


def test_all_primary_anomaly_outputs_are_dataframe_tables() -> None:
    registered = {node.id: node for node in all_node_runners()}
    for node_id in ("AD-001", "AD-003", "AD-004"):
        assert registered[node_id].cache_version == "2"
        assert [
            (item.id, item.type)
            for item in registered[node_id].outputs
        ] == [
            ("thresholds", "dataframe"),
            ("anomalies", "dataframe"),
            ("counts", "dataframe"),
        ]



def test_legacy_workflow_ids_validate_without_unsupported_node_errors() -> None:
    from app.workflow.validation.service import validate_workflow_graph

    legacy_ids = [
        'data_demo_iris',
        'data_select_target_features',
        'transform_standard_scaler',
        'model_random_forest_classifier',
    ]
    graph = {
        'nodes': [
            {'id': f'node-{index}', 'type': 'mlNode', 'data': {'registryId': node_type, 'params': {}}}
            for index, node_type in enumerate(legacy_ids)
        ],
        'edges': [],
    }

    result = validate_workflow_graph(graph)
    unsupported = [error for error in result.errors if error.type == 'unsupported_node_type']
    assert unsupported == []
