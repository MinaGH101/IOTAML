"""Regression tests for multi-frame combination and interactive table editing."""

from __future__ import annotations

import pandas as pd
import pytest

from app.nodes.io import dataframe_result
from app.nodes.utilities.interactive_table_node import InteractiveTableNode
from app.nodes.utilities.merge_dataframes_node import MergeDataFramesNode
from app.workflow.contracts.errors import NodeContractError


def _inputs(*results: dict) -> dict:
    return {"_by_port": {"data": list(results)}, "_edges": []}


def _payload(frame: pd.DataFrame, id_column: str | None = None) -> dict:
    return dataframe_result(frame, id_column=id_column)


def test_vertical_combine_requires_matching_columns_by_default() -> None:
    with pytest.raises(NodeContractError) as error:
        MergeDataFramesNode().run(
            {"id": "combine"},
            _inputs(_payload(pd.DataFrame({"A": [1]})), _payload(pd.DataFrame({"B": [2]}))),
            {"axis": "rows", "row_schema": "match"},
            None,
        )
    assert error.value.problem.code == "COMBINE_COLUMN_SCHEMA_MISMATCH"


def test_horizontal_combine_aligns_all_inputs_by_unique_id() -> None:
    result = MergeDataFramesNode().run(
        {"id": "combine"},
        _inputs(
            _payload(pd.DataFrame({"id": [1, 2], "A": [10, 20]}), "id"),
            _payload(pd.DataFrame({"id": [2, 3], "B": [30, 40]}), "id"),
        ),
        {
            "axis": "columns",
            "column_alignment": "id",
            "id_column": "id",
            "join_type": "outer",
            "duplicate_columns": "suffix",
        },
        None,
    )
    assert result["_df"]["id"].tolist() == [1, 2, 3]
    assert result["_id_column"] == "id"


def test_horizontal_position_alignment_rejects_different_lengths() -> None:
    with pytest.raises(NodeContractError) as error:
        MergeDataFramesNode().run(
            {"id": "combine"},
            _inputs(
                _payload(pd.DataFrame({"A": [1, 2]})),
                _payload(pd.DataFrame({"B": [3]})),
            ),
            {"axis": "columns", "column_alignment": "position"},
            None,
        )
    assert error.value.problem.code == "COMBINE_ROW_COUNT_MISMATCH"


def test_interactive_table_applies_edits_and_selection_to_clean_output() -> None:
    result = InteractiveTableNode().run(
        {"id": "editor", "data": {"label": "Editor"}},
        _inputs(_payload(pd.DataFrame({"id": [1, 2], "A": [10, 20]}), "id")),
        {
            "table_state": {
                "cell_edits": {"source:0": {"A": 99}},
                "selected_rows": ["source:0"],
                "selected_columns": ["A"],
            },
            "max_editable_rows": 500,
        },
        None,
    )
    assert result["_df"].to_dict("records") == [{"id": 1, "A": 99}]
    assert [item["kind"] for item in result["outputs"]] == ["interactive_table", "table"]
    assert result["outputs"][1]["interactive_table_result"] is True
    assert result["outputs"][0]["source_columns"] == ["id", "A"]
    assert result["visible_outputs_only"] is True


def test_interactive_table_added_rows_and_columns_are_deterministic() -> None:
    state = {
        "added_columns": [{"name": "B", "default": None}],
        "added_rows": [{"key": "added:1", "values": {"id": 3, "A": 30, "B": 40}}],
        "cell_edits": {"source:0": {"B": 5}},
    }
    result = InteractiveTableNode().run(
        {"id": "editor"},
        _inputs(_payload(pd.DataFrame({"id": [1, 2], "A": [10, 20]}), "id")),
        {"table_state": state},
        None,
    )
    assert result["_df"].to_dict("records") == [
        {"id": 1, "A": 10, "B": 5},
        {"id": 2, "A": 20, "B": None},
        {"id": 3, "A": 30, "B": 40},
    ]


def test_interactive_table_explicit_empty_selection_returns_empty_result() -> None:
    result = InteractiveTableNode().run(
        {"id": "editor"},
        _inputs(_payload(pd.DataFrame({"id": [1, 2], "A": [10, 20]}), "id")),
        {
            "table_state": {
                "selection_initialized": True,
                "selected_rows": [],
                "selected_columns": [],
            },
        },
        None,
    )
    assert result["_df"].empty
    assert result["_df"].columns.tolist() == []
