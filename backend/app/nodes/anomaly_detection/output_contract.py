"""Single authoritative visible-output contract for anomaly nodes.

Anomaly detectors expose exactly three UI sections: a threshold table, one
tabbed anomaly table, and a wide count table.  Machine-facing dataframe ports
remain available to downstream nodes but are deliberately not rendered as
additional legacy result cards.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from app.nodes.io import dataframe_result, node_label, table_output


def anomaly_display_outputs(
    node: dict[str, Any],
    result: Any,
    max_rows: int,
    *,
    threshold_title: str,
) -> list[dict[str, Any]]:
    """Create the exact three-section anomaly display contract."""
    node_id = str(node["id"])
    label = node_label(node)
    thresholds = table_output(
        node_id, f"{label} · {threshold_title}",
        result.threshold_table.head(max_rows), max_rows,
    )
    thresholds.update({
        "title": threshold_title,
        "output_role": "thresholds",
        "source_handle": "thresholds",
        "source_port_name": "Calculated Thresholds",
    })

    anomaly_tabs: list[dict[str, Any]] = []
    for anomaly_class in result.classes:
        preview = table_output(
            node_id,
            f"{label} · {anomaly_class}",
            result.class_tables[anomaly_class].head(max_rows),
            max_rows,
        )
        preview.update({
            "title": "Detected Anomalies",
            "output_role": "anomalies",
            "tab_group": "anomaly_classes",
            "tab_label": anomaly_class,
            "anomaly_class": anomaly_class,
            "column_labels": result.class_column_labels,
            "source_handle": "anomalies",
            "source_port_name": "Detected Anomalies",
        })
        anomaly_tabs.append(preview)

    counts = table_output(
        node_id, f"{label} · Anomaly Class Counts",
        result.count_table.head(max_rows), max_rows,
    )
    counts.update({
        "title": "Anomaly Class Counts",
        "output_role": "counts",
        "barplot_ready": True,
        "category_column": "class",
        "value_columns": [pair.label for pair in result.column_pairs],
        "source_handle": "counts",
        "source_port_name": "Anomaly Class Counts",
    })
    return [thresholds, *anomaly_tabs, counts]


def anomaly_node_response(
    result: Any,
    display_outputs: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return exactly three dataframe ports and no legacy JSON/report output.

    The anomaly-class port carries the normalized long-form anomaly records for
    downstream processing, while its visible representation is the requested
    tabbed wide table group.
    """
    anomaly_records = pd.DataFrame(result.anomaly_records)
    threshold_payload = dataframe_result(
        result.threshold_table,
        id_column="class",
        reset_lineage=True,
    )
    anomaly_payload = dataframe_result(
        anomaly_records,
        # One sample can legitimately occur in several variables/classes, so
        # ``sample`` is not a dataframe ID and must never be advertised as one.
        id_column=None,
        reset_lineage=True,
    )
    count_payload = dataframe_result(
        result.count_table,
        id_column="class",
        reset_lineage=True,
    )
    return {
        "thresholds": threshold_payload,
        "anomalies": anomaly_payload,
        "counts": count_payload,
        "outputs_by_port": {
            "thresholds": threshold_payload,
            "anomalies": anomaly_payload,
            "counts": count_payload,
        },
        "output": display_outputs[0],
        "outputs": display_outputs,
        "visible_outputs_only": True,
        "_report": result.report(),
    }
