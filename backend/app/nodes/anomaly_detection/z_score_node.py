"""Z-score anomaly workflow node using separate calculation/detection inputs."""

from __future__ import annotations

from app.nodes.anomaly_detection.anomalies import DualDataAnomalyDetector
from app.nodes.anomaly_detection.input_selection import selected_input_dataframe
from app.nodes.anomaly_detection.output_contract import anomaly_display_outputs, anomaly_node_response
from app.nodes.base import BaseNode, port, setting
from app.nodes.io import (
    ensure_df,
    numeric_df,
    parse_number_list,
    selected_columns,
)


class ZScoreOutlierNode(BaseNode):
    """Calculate X + kS classes and report aligned values from another frame."""
    id = "AD-001"
    name = "Z-Score Anomaly Detector"
    category = "Anomaly Detection"
    description = (
        "Calculates X ± kS classes on one dataframe and returns the matching "
        "sample values from a second dataframe."
    )
    # Version 2 invalidates cached legacy JSON/report-shaped results.
    cache_version = "2"

    inputs = [port("data", "Input DataFrames", "dataframe", True, True)]

    outputs = [
        port("thresholds", "Calculated Thresholds", "dataframe"),
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
            help="دیتافریم متصل برای محاسبه آستانه‌های X ± kS.",
        ),
        setting(
            "detection_source",
            "دیتافریم اعمال تشخیص ناهنجاری",
            "input_dataframe",
            "",
            required=True,
            supports_dynamic=False,
            help="نمونه‌ها و مقادیر ناهنجار از این دیتافریم گزارش می‌شوند.",
        ),
        setting(
            "columns",
            "ستون‌های محاسبه آستانه",
            "columns",
            [],
            help="ستون‌ها از دیتافریم محاسبه آستانه انتخاب می‌شوند.",
        ),
        setting(
            "thresholds",
            "ضرایب انحراف معیار",
            "text",
            "1, 2, 3",
            help="ضرایب مثبت برای ساخت کلاس‌های X ± kS.",
        ),
        setting(
            "center_method",
            "روش محاسبه مرکز",
            "select",
            "mean",
            options=["mean", "median"],
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
        columns = selected_columns(settings, calculation_df) or list(
            numeric_df(calculation_df).columns
        )
        thresholds = parse_number_list(
            settings.get("thresholds") or settings.get("threshold"),
            default=[1.0, 2.0, 3.0],
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
        result = detector.zscore(
            thresholds,
            center_method=str(settings.get("center_method") or "mean"),
            tail="upper",
            ddof=1,
        )
        display_outputs = anomaly_display_outputs(
            node, result, max_rows,
            threshold_title="Calculated Anomaly Thresholds",
        )
        return anomaly_node_response(result, display_outputs)
