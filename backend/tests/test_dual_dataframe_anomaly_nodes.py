"""Regression and contract tests for dual dataframe anomaly nodes."""

from __future__ import annotations

import pandas as pd

from app.nodes.anomaly_detection.z_score_node import ZScoreOutlierNode
from app.nodes.io import dataframe_result


def _inputs() -> dict:
    normalized = pd.DataFrame({
        "sample_id": ["S1", "S2", "S3", "S4", "S5"],
        "Ln_Au": [-1.0, -0.5, 0.0, 0.5, 5.0],
    })
    raw = pd.DataFrame({
        "sample_id": ["S1", "S2", "S3", "S4", "S5"],
        "raw_Au": [5.0, 10.0, 20.0, 30.0, 500.0],
    })
    return {
        "normalized-node": dataframe_result(normalized, id_column="sample_id"),
        "raw-node": dataframe_result(raw, id_column="sample_id"),
        "_by_port": {},
        "_edges": [
            {"source": "normalized-node", "sourceHandle": "dataframe", "targetHandle": "data"},
            {"source": "raw-node", "sourceHandle": "dataframe", "targetHandle": "data"},
        ],
    }


def test_zscore_uses_one_multiple_port_and_two_source_selectors() -> None:
    assert len(ZScoreOutlierNode.inputs) == 1
    assert ZScoreOutlierNode.inputs[0].id == "data"
    assert ZScoreOutlierNode.inputs[0].multiple is True
    settings = {item.name: item for item in ZScoreOutlierNode.settings_schema}
    assert settings["calculation_source"].type == "input_dataframe"
    assert settings["detection_source"].type == "input_dataframe"
    assert "tail" not in settings
    assert "std_ddof" not in settings
    assert [
        (item.id, item.type)
        for item in ZScoreOutlierNode.outputs
    ] == [
        ("thresholds", "dataframe"),
        ("anomalies", "dataframe"),
        ("counts", "dataframe"),
    ]


def test_zscore_calculates_on_one_dataframe_and_reports_the_other() -> None:
    result = ZScoreOutlierNode().run(
        {"id": "anomaly-node", "data": {"label": "Anomalies"}},
        _inputs(),
        {
            "calculation_source": "normalized-node",
            "detection_source": "raw-node",
            "columns": ["Ln_Au"],
            "thresholds": "1, 2, 3",
            "center_method": "mean",
            "max_output_rows": 500,
        },
        {},
    )
    assert set(result) >= {"thresholds", "anomalies", "counts", "outputs"}
    anomaly_frame = result["anomalies"]["_df"]
    assert anomaly_frame.iloc[0]["sample"] == "S5"
    assert anomaly_frame.iloc[0]["value"] == 500.0
    assert result["anomalies"]["_id_column"] is None
    roles = [output["output_role"] for output in result["outputs"]]
    assert roles[0] == "thresholds"
    assert roles[-1] == "counts"
    assert set(roles[1:-1]) == {"anomalies"}
    assert all(output["kind"] == "table" for output in result["outputs"])
    assert "report" not in result
    assert "json" not in result


def test_zscore_rejects_an_unconnected_selection_immediately() -> None:
    try:
        ZScoreOutlierNode().run(
            {"id": "anomaly-node"},
            _inputs(),
            {
                "calculation_source": "missing-node",
                "detection_source": "raw-node",
            },
            {},
        )
    except ValueError as exc:
        assert "not connected" in str(exc)
    else:
        raise AssertionError("An unconnected dataframe selection must fail.")
