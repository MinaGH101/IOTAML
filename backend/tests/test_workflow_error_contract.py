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


def test_node_contract_error_uses_the_canvas_label_in_its_message() -> None:
    problem = normalize_node_exception(
        NodeContractError(
            "NODE_DATAFRAME_INPUT_REQUIRED",
            "Node MR-008-1789726177137-206be6b1fe05b requires a dataframe input.",
            category="input",
            suggested_fix="Connect a dataframe.",
        ),
        node_id="MR-008-1789726177137-206be6b1fe05b",
        node_name="Random Forest Model",
    )
    assert problem.message == "Node 'Random Forest Model' requires a dataframe input."


def test_unexpected_type_error_is_owned_by_application() -> None:
    problem = normalize_node_exception(
        TypeError("'Index' object is not callable"),
        node_id="node-7",
        node_name="Anomaly",
    )
    assert problem.code == "NODE_APPLICATION_ERROR"
    assert problem.responsibility == "application"
