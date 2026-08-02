"""Multi-input dataframe combination node.

The node has one repeatable dataframe port.  Vertical combination appends rows
and makes the column-schema policy explicit.  Horizontal combination appends
columns either by row position or by a validated ID column.  No implicit
fallback from one strategy to another is permitted.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

import pandas as pd

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import all_dataframe_payloads, dataframe_result, node_label, table_output
from app.workflow.contracts.errors import NodeContractError


def _duplicates(values: pd.Series) -> list[Any]:
    """Return a short JSON-friendly preview of duplicated non-null values."""
    return values[values.duplicated(keep=False)].drop_duplicates().head(10).tolist()


class MergeDataFramesNode(BaseNode):
    """Combine two or more connected dataframes along rows or columns."""

    id = "UT-003"
    name = "Combine DataFrames"
    category = "Data Cleaning"
    description = "Combines multiple dataframes vertically or horizontally with explicit schema and ID rules."
    inputs = [port("data", "DataFrames", "dataframe", True, True)]
    outputs = [
        port("dataframe", "Combined DataFrame", "dataframe"),
        port("report", "Combination Report", "json"),
    ]
    settings_schema = [
        setting("axis", "محور ترکیب", "select", "rows", options=["rows", "columns"]),
        setting(
            "row_schema",
            "قانون ستون‌ها در ترکیب عمودی",
            "select",
            "match",
            options=["match", "union", "intersection"],
            help="در حالت match نام و ترتیب ستون‌های همه ورودی‌ها باید یکسان باشد.",
        ),
        setting(
            "column_alignment",
            "روش تطبیق ردیف‌ها در ترکیب افقی",
            "select",
            "id",
            options=["id", "position"],
        ),
        setting("id_column", "ستون شناسه برای تطبیق", "text", ""),
        setting("join_type", "نوع اتصال شناسه", "select", "outer", options=["inner", "outer", "left"]),
        setting(
            "duplicate_columns",
            "برخورد با نام ستون تکراری",
            "select",
            "suffix",
            options=["error", "suffix"],
        ),
        setting("max_output_rows", "حداکثر ردیف خروجی", "integer", 200),
    ]
    cache_version = "3"

    def run(self, node, inputs, settings, context):
        """Validate every input contract and produce one combined dataframe."""
        del context
        payloads = all_dataframe_payloads(inputs, "data")
        if len(payloads) < 2:
            raise NodeContractError(
                "COMBINE_INPUT_COUNT",
                "Combine DataFrames requires at least two connected dataframe inputs.",
                category="input",
                port="data",
                expected="at least 2 dataframes",
                actual=len(payloads),
                suggested_fix="Connect two or more dataframe outputs to the DataFrames input.",
            )
        frames = [payload.df.copy() for payload in payloads]
        axis = str(settings.get("axis") or "rows")
        if axis not in {"rows", "columns"}:
            raise NodeContractError(
                "COMBINE_AXIS_INVALID",
                f"Unknown combination axis '{axis}'.",
                category="setting",
                setting="axis",
                expected=["rows", "columns"],
                actual=axis,
                suggested_fix="Choose vertical rows or horizontal columns.",
            )

        if axis == "rows":
            result, id_column, report = self._combine_rows(frames, payloads, settings)
        else:
            result, id_column, report = self._combine_columns(frames, payloads, settings)

        preview = table_output(
            str(node["id"]), f"{node_label(node)} · Combined DataFrame",
            result, max(1, int(settings.get("max_output_rows") or 200)),
        )
        return dataframe_result(
            result,
            id_column=id_column,
            reset_lineage=True,
            report=report,
            output=preview,
            outputs=[preview],
        )

    def _combine_rows(self, frames, payloads, settings):
        """Append records using an explicit column schema policy."""
        policy = str(settings.get("row_schema") or "match")
        columns = [[str(column) for column in frame.columns] for frame in frames]
        if policy == "match":
            mismatches = [
                {"input": index + 1, "columns": current}
                for index, current in enumerate(columns)
                if current != columns[0]
            ]
            if mismatches:
                raise NodeContractError(
                    "COMBINE_COLUMN_SCHEMA_MISMATCH",
                    "Vertical combination requires identical column names and order.",
                    category="data",
                    expected=columns[0],
                    actual=mismatches,
                    suggested_fix="Select union/intersection or make the input schemas identical.",
                )
            selected = columns[0]
        elif policy == "union":
            selected = list(dict.fromkeys(column for group in columns for column in group))
        elif policy == "intersection":
            selected = [
                column for column in columns[0]
                if all(column in group for group in columns[1:])
            ]
            if not selected:
                raise NodeContractError(
                    "COMBINE_NO_COMMON_COLUMNS",
                    "The input dataframes have no common columns.",
                    category="data",
                    expected="at least one shared column",
                    actual=columns,
                    suggested_fix="Use union or connect dataframes with shared column names.",
                )
        else:
            raise NodeContractError(
                "COMBINE_ROW_SCHEMA_INVALID",
                f"Unknown row schema policy '{policy}'.",
                category="setting",
                setting="row_schema",
                expected=["match", "union", "intersection"],
                actual=policy,
                suggested_fix="Choose a supported vertical schema policy.",
            )
        result = pd.concat(
            [frame.reindex(columns=selected) for frame in frames],
            axis=0,
            ignore_index=True,
        )
        ids = {payload.id_column for payload in payloads}
        id_column = ids.pop() if len(ids) == 1 else None
        return result, id_column if id_column in result.columns else None, {
            "axis": "rows", "schema_policy": policy, "input_count": len(frames),
            "rows": len(result), "columns": selected,
        }

    def _combine_columns(self, frames, payloads, settings):
        """Append variables by row position or validated ID values."""
        alignment = str(settings.get("column_alignment") or "id")
        conflict = str(settings.get("duplicate_columns") or "suffix")
        if conflict not in {"error", "suffix"}:
            raise NodeContractError(
                "COMBINE_DUPLICATE_POLICY_INVALID",
                f"Unknown duplicate-column policy '{conflict}'.",
                category="setting",
                setting="duplicate_columns",
                expected=["error", "suffix"],
                actual=conflict,
                suggested_fix="Choose error or automatic suffixes.",
            )
        if alignment == "position":
            lengths = [len(frame) for frame in frames]
            if len(set(lengths)) != 1:
                raise NodeContractError(
                    "COMBINE_ROW_COUNT_MISMATCH",
                    "Position-based horizontal combination requires equal row counts.",
                    category="data",
                    expected=lengths[0],
                    actual=lengths,
                    suggested_fix="Use ID alignment or make all input row counts equal.",
                )
            id_column = payloads[0].id_column
            prepared = self._prepare_horizontal_columns(
                frames, id_column, conflict, keep_all_ids=False,
            )
            result = pd.concat([frame.reset_index(drop=True) for frame in prepared], axis=1)
        elif alignment == "id":
            id_column = str(settings.get("id_column") or "").strip()
            if not id_column:
                inferred = {payload.id_column for payload in payloads if payload.id_column}
                id_column = inferred.pop() if len(inferred) == 1 else ""
            missing = [index + 1 for index, frame in enumerate(frames) if id_column not in frame.columns]
            if not id_column or missing:
                raise NodeContractError(
                    "COMBINE_ID_COLUMN_MISSING",
                    "The selected ID column is not available in every input dataframe.",
                    category="data",
                    setting="id_column",
                    column=id_column or None,
                    expected="one shared ID column",
                    actual={"missing_in_inputs": missing},
                    suggested_fix="Choose an ID column that exists in every connected dataframe.",
                )
            for index, frame in enumerate(frames):
                duplicate_values = _duplicates(frame[id_column])
                if duplicate_values:
                    raise NodeContractError(
                        "COMBINE_DUPLICATE_IDS",
                        f"Input {index + 1} contains duplicate ID values.",
                        category="data",
                        column=id_column,
                        expected="unique, non-empty IDs",
                        actual=duplicate_values,
                        suggested_fix="Remove duplicate IDs or use position alignment.",
                    )
                if frame[id_column].isna().any():
                    raise NodeContractError(
                        "COMBINE_EMPTY_IDS",
                        f"Input {index + 1} contains empty ID values.",
                        category="data",
                        column=id_column,
                        expected="non-empty IDs",
                        actual=int(frame[id_column].isna().sum()),
                        suggested_fix="Fill or remove empty IDs before combining.",
                    )
            join_type = str(settings.get("join_type") or "outer")
            if join_type not in {"inner", "outer", "left"}:
                raise NodeContractError(
                    "COMBINE_JOIN_TYPE_INVALID",
                    f"Unknown ID join type '{join_type}'.",
                    category="setting",
                    setting="join_type",
                    expected=["inner", "outer", "left"],
                    actual=join_type,
                    suggested_fix="Choose inner, outer, or left.",
                )
            prepared = self._prepare_horizontal_columns(
                frames, id_column, conflict, keep_all_ids=True,
            )
            result = prepared[0]
            for frame in prepared[1:]:
                result = result.merge(frame, on=id_column, how=join_type, validate="one_to_one")
        else:
            raise NodeContractError(
                "COMBINE_ALIGNMENT_INVALID",
                f"Unknown horizontal alignment '{alignment}'.",
                category="setting",
                setting="column_alignment",
                expected=["id", "position"],
                actual=alignment,
                suggested_fix="Choose ID or position alignment.",
            )
        return result, id_column if id_column and id_column in result.columns else None, {
            "axis": "columns", "alignment": alignment, "input_count": len(frames),
            "rows": len(result), "columns": [str(column) for column in result.columns],
        }

    @staticmethod
    def _prepare_horizontal_columns(frames, id_column, conflict, *, keep_all_ids):
        """Validate or suffix duplicate non-ID variable names deterministically."""
        counts = Counter(
            str(column)
            for frame in frames
            for column in frame.columns
            if str(column) != str(id_column or "")
        )
        duplicated = sorted(column for column, count in counts.items() if count > 1)
        if duplicated and conflict == "error":
            raise NodeContractError(
                "COMBINE_DUPLICATE_COLUMNS",
                "Horizontal inputs contain duplicate variable names.",
                category="data",
                expected="unique non-ID columns",
                actual=duplicated,
                suggested_fix="Rename the columns or choose automatic suffixes.",
            )
        prepared = []
        for index, frame in enumerate(frames, start=1):
            rename = {
                column: f"{column}__input{index}"
                for column in frame.columns
                if str(column) != str(id_column or "") and str(column) in duplicated
            }
            current = frame.rename(columns=rename)
            if not keep_all_ids and index > 1 and id_column and id_column in current.columns:
                current = current.drop(columns=[id_column])
            prepared.append(current)
        return prepared
