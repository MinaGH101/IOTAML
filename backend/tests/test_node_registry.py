from app.nodes.registry import (
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



def test_legacy_workflow_ids_validate_without_unsupported_node_errors() -> None:
    from app.workflow.validator import validate_workflow_graph

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
