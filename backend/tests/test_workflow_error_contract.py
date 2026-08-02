"""Tests for user-owned versus application-owned workflow failures."""

from app.workflow.contracts.errors import NodeContractError, normalize_node_exception


def test_node_contract_error_preserves_actionable_context() -> None:
    problem = normalize_node_exception(
        NodeContractError(
            "COLUMN_MISSING",
            "Column 'Ag' is missing.",
            category="data",
            column="Ag",
            expected=["Ag"],
            actual=["Au"],
            suggested_fix="Select an existing column.",
        ),
        node_id="node-7",
        node_name="Anomaly",
    )
    assert problem.responsibility == "user"
    assert problem.node_id == "node-7"
    assert problem.column == "Ag"


def test_unexpected_type_error_is_owned_by_application() -> None:
    problem = normalize_node_exception(
        TypeError("'Index' object is not callable"),
        node_id="node-7",
        node_name="Anomaly",
    )
    assert problem.code == "NODE_APPLICATION_ERROR"
    assert problem.responsibility == "application"
