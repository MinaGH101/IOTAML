"""Editable dataframe node with a persisted operation-based table state.

The workflow document stores only edits, additions, and selections—not a second
copy of the source dataframe.  Re-execution deterministically applies that state
to the current upstream dataframe and exposes the clean result to downstream
nodes.  The editor output contains both current and original values so the
frontend can highlight changes and show previous-value tooltips.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

import pandas as pd
from pandas.api.types import is_bool_dtype, is_numeric_dtype

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, dataframe_result, node_label, output, safe_json, table_output
from app.workflow.contracts.errors import NodeContractError


def _state_dict(value: Any) -> dict[str, Any]:
    """Return a normalized, versioned editor state."""
    if value in (None, ""):
        return {}
    if not isinstance(value, dict):
        raise NodeContractError(
            "INTERACTIVE_TABLE_STATE_INVALID",
            "Interactive table state is not an object.",
            category="setting",
            setting="table_state",
            expected="an editor-state object",
            actual=type(value).__name__,
            suggested_fix="Reset the interactive table state and run the node again.",
        )
    expected_types = {
        "selection_initialized": bool,
        "cell_edits": dict,
        "added_rows": list,
        "added_columns": list,
        "selected_rows": list,
        "selected_columns": list,
    }
    invalid = {
        field: type(value.get(field)).__name__
        for field, expected_type in expected_types.items()
        if field in value and not isinstance(value.get(field), expected_type)
    }
    if invalid:
        raise NodeContractError(
            "INTERACTIVE_TABLE_STATE_FIELDS_INVALID",
            "Interactive table state contains fields with invalid types.",
            category="setting",
            setting="table_state",
            expected={field: expected.__name__ for field, expected in expected_types.items()},
            actual=invalid,
            suggested_fix="Reset the interactive table state and apply the edits again.",
        )
    return value


def _coerce_cell_value(value: Any, series: pd.Series) -> Any:
    """Preserve an existing column's primitive dtype when an edit permits it."""
    if value == "":
        return None
    if is_bool_dtype(series.dtype) and isinstance(value, str):
        lowered = value.strip().casefold()
        if lowered in {"true", "1", "yes", "بله"}:
            return True
        if lowered in {"false", "0", "no", "خیر"}:
            return False
    if is_numeric_dtype(series.dtype):
        numeric = pd.to_numeric(value, errors="coerce")
        if pd.notna(numeric):
            return numeric.item() if hasattr(numeric, "item") else numeric
    return value


class InteractiveTableNode(BaseNode):
    """Let users edit/select a dataframe and emit the clean persisted result."""

    id = "UT-008"
    name = "Interactive Table"
    category = "Data Cleaning"
    description = "Edits cells, adds rows or columns, selects data, and passes the clean changed table downstream."
    inputs = [port("data", "DataFrame", "dataframe")]
    outputs = [
        port("dataframe", "Clean Changed DataFrame", "dataframe"),
        port("editor", "Interactive Table", "json"),
    ]
    settings_schema = [
        setting(
            "table_state", "وضعیت جدول تعاملی", "interactive_table_state", {},
            supports_dynamic=False,
            help="این مقدار توسط خود جدول مدیریت می‌شود.",
        ),
        setting("max_editable_rows", "حداکثر ردیف قابل ویرایش", "integer", 500),
    ]
    cacheable = False
    cache_version = "2"

    def run(self, node, inputs, settings, context):
        """Apply persisted table operations and return editor plus clean output."""
        del context
        payload = dataframe_payload(inputs, "data")
        if payload is None:
            raise NodeContractError(
                "INTERACTIVE_TABLE_INPUT_REQUIRED",
                "Interactive Table requires a dataframe input.",
                category="input",
                port="data",
                expected="dataframe",
                actual="disconnected or non-dataframe",
                suggested_fix="Connect a dataframe output to the Interactive Table input.",
            )
        source = payload.df.copy()
        max_rows = max(1, min(5000, int(settings.get("max_editable_rows") or 500)))
        if len(source) > max_rows:
            raise NodeContractError(
                "INTERACTIVE_TABLE_ROW_LIMIT",
                f"The dataframe has {len(source)} rows, above the editable limit of {max_rows}.",
                category="data",
                expected=f"at most {max_rows} rows",
                actual=len(source),
                suggested_fix="Filter/sample the dataframe first or increase the editable-row limit.",
            )

        state = _state_dict(settings.get("table_state"))
        current, row_keys, previous_values = self._apply_state(source, state)
        selection_initialized = (
            state.get("selection_initialized") is True
            or bool(state.get("selected_rows"))
            or bool(state.get("selected_columns"))
        )
        selected_rows = {str(value) for value in state.get("selected_rows", [])}
        selected_columns = [
            str(column) for column in state.get("selected_columns", [])
            if str(column) in current.columns
        ]
        clean = current.copy()
        if selection_initialized:
            clean = clean.loc[
                [index for index, key in enumerate(row_keys) if key in selected_rows]
            ].copy()
        if selection_initialized:
            retained = [
                column for column in selected_columns
                if column in clean.columns
            ]
            if selected_columns and payload.id_column and payload.id_column in clean.columns and payload.id_column not in retained:
                retained.insert(0, payload.id_column)
            clean = clean.loc[:, retained]
        clean = clean.reset_index(drop=True)
        clean_id = payload.id_column if payload.id_column in clean.columns else None

        editor_rows = []
        original_rows = source.where(source.notna(), None).to_dict(orient="records")
        for index, record in enumerate(current.where(current.notna(), None).to_dict(orient="records")):
            editor_rows.append({"__row_key": row_keys[index], **record})
        editor = output(
            str(node["id"]),
            f"{node_label(node)} · Interactive Table",
            "interactive_table",
            columns=[str(column) for column in current.columns],
            rows=editor_rows,
            original_rows=original_rows,
            previous_values=previous_values,
            state=safe_json(state),
            id_column=payload.id_column,
            source_columns=[str(column) for column in source.columns],
        )
        clean_preview = table_output(
            str(node["id"]),
            f"{node_label(node)} · Clean Changed Table",
            clean,
            max_rows,
        )
        clean_preview.update({
            "interactive_table_result": True,
            "interactive_source_handle": "editor",
        })
        editor.update({"source_handle": "editor", "source_port_name": "Interactive Table"})
        clean_preview.update({"source_handle": "dataframe", "source_port_name": "Clean Changed DataFrame"})
        response = dataframe_result(
            clean,
            id_column=clean_id,
            reset_lineage=True,
            editor=editor,
            output=editor,
            outputs=[editor, clean_preview],
        )
        response["visible_outputs_only"] = True
        return response

    @staticmethod
    def _apply_state(source, state):
        """Apply added columns/rows and cell edits in stable row-key space."""
        current = source.copy().reset_index(drop=True)
        row_keys = [f"source:{index}" for index in range(len(current))]
        for definition in state.get("added_columns", []):
            if not isinstance(definition, dict):
                continue
            name = str(definition.get("name") or "").strip()
            if not name or name in current.columns:
                continue
            current[name] = definition.get("default")
        for added in state.get("added_rows", []):
            if not isinstance(added, dict):
                continue
            key = str(added.get("key") or f"added:{uuid4().hex}")
            values = added.get("values") if isinstance(added.get("values"), dict) else {}
            current.loc[len(current)] = {
                column: values.get(str(column))
                for column in current.columns
            }
            row_keys.append(key)

        previous_values: dict[str, Any] = {}
        edits = state.get("cell_edits") if isinstance(state.get("cell_edits"), dict) else {}
        positions = {key: index for index, key in enumerate(row_keys)}
        for row_key, row_edits in edits.items():
            position = positions.get(str(row_key))
            if position is None or not isinstance(row_edits, dict):
                continue
            for column, value in row_edits.items():
                column = str(column)
                if column not in current.columns:
                    continue
                change_key = f"{row_key}::{column}"
                previous_values[change_key] = safe_json(current.at[position, column])
                current.at[position, column] = _coerce_cell_value(value, current[column])
        return current, row_keys, previous_values
