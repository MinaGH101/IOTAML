from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from io import StringIO

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import calculation_columns, dataframe_payload, dataframe_result, ensure_df, node_label, table_output


def _clean_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(
        series.astype(str)
        .str.replace(",", "", regex=False)
        .str.replace("<", "", regex=False)
        .str.replace(">", "", regex=False)
        .str.strip(),
        errors="coerce",
    )


def _condition_mask(values: pd.Series, dl_values: pd.Series, condition: str) -> pd.Series:
    if condition == ">":
        return values > dl_values
    if condition == ">=":
        return values >= dl_values
    if condition == "<":
        return values < dl_values
    if condition == "<=":
        return values <= dl_values
    raise ValueError("Condition must be one of: >, >=, <, <=")


def _replacement(dl: pd.Series, mode: str) -> pd.Series | float:
    if mode == "DL":
        return dl
    if mode == "2/3DL":
        return dl * (2 / 3)
    if mode == "3/4DL":
        return dl * (3 / 4)
    if mode == "0":
        return 0.0
    raise ValueError("Replacement must be one of: DL, 2/3DL, 3/4DL, 0")


class DetectionLimitHandlingNode(BaseNode):
    id = "CL-010"
    name = "Detection Limit Handling"
    category = "Data Cleaning"
    description = "Handles censored values using a detection-limit table."

    inputs = [
        port("data", "DataFrame", "dataframe"),
    ]

    outputs = [
        port("dataframe", "Censored DataFrame", "dataframe"),
        port("report", "Censoring Report", "json"),
    ]

    settings_schema = [
        setting("dl_file", "Detection Limit CSV", "file", None, True),
        setting("condition", "Replacing Condition", "select", "<=", True, [">", ">=", "<", "<="], False),
        setting("replacement", "Replacing Value", "select", "2/3DL", True, ["DL", "2/3DL", "3/4DL", "0"], False),
        setting("max_output_rows", "Max Output Rows", "integer", 100),
    ]

    def run(self, node: dict[str, Any], inputs: dict[str, Any], settings: dict[str, Any], context: Any) -> dict[str, Any]:
        payload = dataframe_payload(inputs, "data")
        df = ensure_df(payload.df if payload else None, str(node["id"]))

        dl_file = str(settings.get("dl_file") or "").strip()
        if not dl_file:
            raise ValueError("Detection Limit CSV file is required.")

        dl_df = pd.read_csv(StringIO(dl_file))

        if dl_df.empty:
            raise ValueError("Detection limit table is empty.")

        dl_row = dl_df.iloc[0]
        condition = str(settings.get("condition") or "<=")
        replacement_mode = str(settings.get("replacement") or "2/3DL")
        max_rows = int(settings.get("max_output_rows") or 100)

        common_columns = [col for col in calculation_columns(df) if col in dl_df.columns]
        if not common_columns:
            raise ValueError("No matching columns found between input DataFrame and detection limit table.")

        report: list[dict[str, Any]] = []
        changed_indexes: set[Any] = set()

        for col in common_columns:
            dl_value = pd.to_numeric(pd.Series([dl_row[col]]), errors="coerce").iloc[0]
            if pd.isna(dl_value):
                continue

            values = _clean_numeric(df[col])
            dl_series = pd.Series(float(dl_value), index=df.index)
            mask = _condition_mask(values, dl_series, condition).fillna(False)

            count = int(mask.sum())
            if count:
                replacement_values = _replacement(dl_series, replacement_mode)
                df.loc[mask, col] = replacement_values[mask] if isinstance(replacement_values, pd.Series) else replacement_values
                changed_indexes.update(df.index[mask].tolist())

            report.append({
                "column": str(col),
                "detection_limit": float(dl_value),
                "condition": condition,
                "replacement": replacement_mode,
                "censored_rows": count,
            })

        changed_df = df.loc[sorted(changed_indexes)].head(max_rows) if changed_indexes else df.head(0)

        summary = {
            "matched_columns": len(common_columns),
            "changed_rows": len(changed_indexes),
            "condition": condition,
            "replacement": replacement_mode,
            "details": report,
        }

        return dataframe_result(
            df,
            id_column=payload.id_column if payload and payload.id_column in df.columns else None,
            meta={**(payload.meta if payload else {}), "detection_limit_handling": summary},
            report=summary,
            json=summary,
            output=table_output(str(node["id"]), f"{node_label(node)} · Changed Rows", changed_df, max_rows),
            outputs=[
                table_output(str(node["id"]), f"{node_label(node)} · Censoring Report", pd.DataFrame(report), 100),
                table_output(str(node["id"]), f"{node_label(node)} · Changed Rows", changed_df, max_rows),
            ],
        )
