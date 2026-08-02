"""Manual-threshold anomaly node with separate calculation/detection inputs."""

from __future__ import annotations

import pandas as pd

from app.nodes.anomaly_detection.anomalies import DualDataAnomalyDetector
from app.nodes.anomaly_detection.input_selection import selected_input_dataframe
from app.nodes.anomaly_detection.output_contract import anomaly_display_outputs, anomaly_node_response
from app.nodes.base import BaseNode, port, setting
from app.nodes.io import (
    calculation_columns,
    ensure_df,
    numeric_df,
    parse_number_list,
)


def _selected_columns(settings: dict, df: pd.DataFrame) -> list[str]:
    """Read selected calculation columns while excluding the workflow ID."""
    raw = settings.get("columns")
    if isinstance(raw, list):
        selected = [str(column) for column in raw if str(column)]
    elif isinstance(raw, str):
        selected = [column.strip() for column in raw.split(",") if column.strip()]
    else:
        selected = []
    legacy = str(settings.get("column") or "").strip()
    if not selected and legacy:
        selected = [legacy]
    allowed = set(calculation_columns(df))
    invalid = [column for column in selected if column not in allowed]
    if invalid:
        raise ValueError(
            "The workflow ID cannot be used as a calculation column: "
            + ", ".join(invalid)
        )
    return selected or [str(column) for column in numeric_df(df).columns]


class ThresholdAnomalyNode(BaseNode):
    """Assign manual classes and report aligned values from another dataframe."""
    id = "AD-004"
    name = "Threshold Anomaly Detector"
    category = "Anomaly Detection"
    description = (
        "Applies manual threshold classes to one dataframe and returns matching "
        "sample values from a second dataframe."
    )
    # Version 2 invalidates cached legacy JSON/report-shaped results.
    cache_version = "2"

    inputs = [port("data", "Input DataFrames", "dataframe", True, True)]

    outputs = [
        port("thresholds", "Threshold Table", "dataframe"),
        port("anomalies", "Detected Anomalies", "dataframe"),
        port("counts", "Anomaly Class Counts", "dataframe"),
    ]

    settings_schema = [
        setting(
            "calculation_source",
            "دیتافریم محاسبه کلاس‌های ناهنجاری",
            "input_dataframe",
            "",
            required=True,
            supports_dynamic=False,
            help="دیتافریم متصل برای تعیین عضویت نمونه‌ها در کلاس‌های دستی.",
        ),
        setting(
            "detection_source",
            "دیتافریم اعمال تشخیص ناهنجاری",
            "input_dataframe",
            "",
            required=True,
            supports_dynamic=False,
            help="مقادیر نمونه‌های انتخاب‌شده از این دیتافریم گزارش می‌شوند.",
        ),
        setting("columns", "ستون‌ها", "columns", []),
        setting(
            "operator",
            "عملگر",
            "select",
            ">",
            options=[">", ">=", "<", "<=", "==", "!="],
        ),
        setting(
            "thresholds",
            "آستانه‌ها",
            "text",
            "0",
            help="آستانه‌های دستی با جداکننده ویرگول.",
        ),
        setting("max_output_rows", "حداکثر ردیف خروجی", "integer", 500),
    ]

    def run(self, node, inputs, settings, context):
        """Execute the node using the two upstream sources selected in settings."""
        calculation_payload = selected_input_dataframe(
            inputs,
            settings.get("calculation_source"),
            "anomaly class calculation",
        )
        calculation_df = ensure_df(
            calculation_payload.df if calculation_payload else None,
            str(node["id"]),
        )
        detection_payload = selected_input_dataframe(
            inputs,
            settings.get("detection_source"),
            "anomaly detection",
        )
        detection_df = ensure_df(
            detection_payload.df if detection_payload else None,
            str(node["id"]),
        )

        columns = _selected_columns(settings, calculation_df)
        thresholds = parse_number_list(
            settings.get("thresholds") or settings.get("threshold"),
            default=[0.0],
        )
        max_rows = max(1, int(settings.get("max_output_rows") or 500))
        detector = DualDataAnomalyDetector(
            calculation_df,
            detection_df,
            calculation_id_column=(
                calculation_payload.id_column if calculation_payload else None
            ),
            detection_id_column=(
                detection_payload.id_column if detection_payload else None
            ),
            columns=columns,
        )
        result = detector.manual(
            thresholds,
            operator=str(settings.get("operator") or ">"),
        )
        display_outputs = anomaly_display_outputs(
            node, result, max_rows,
            threshold_title="Manual Anomaly Thresholds",
        )
        return anomaly_node_response(result, display_outputs)
