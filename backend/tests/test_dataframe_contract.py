from __future__ import annotations

import time

import joblib
import pandas as pd

from app.nodes.cleaning.select_columns_node import SelectColumnsNode
from app.nodes.io import (
    DATAFRAME_CONTRACT_VERSION,
    apply_dataframe_contract,
    calculation_columns,
    dataframe_payload,
    dataframe_result,
)
from app.workflow.runtime_context import RuntimeContext


def frame() -> pd.DataFrame:
    return pd.DataFrame({
        "sample_id": ["s1", "s2", "s3", "s4"],
        "batch_id": ["b1", "b1", "b2", "b2"],
        "Au": [1.0, 2.0, 3.0, 4.0],
        "Cu": [10.0, 20.0, 30.0, 40.0],
    })


def test_payloads_share_one_lineage_source_without_eager_dataframe_copies() -> None:
    source_frame = frame()
    source = dataframe_result(source_frame, id_column="sample_id")
    first = dataframe_payload({"input": source})
    second = first.copy()
    assert first is dataframe_payload({"input": source})
    assert first.lineage is second.lineage
    assert first.lineage.source_df is source_frame
    assert first.df is source_frame


def test_contract_is_idempotent_and_applied_once_to_multi_output_results() -> None:
    source = dataframe_result(frame(), id_column="sample_id")
    corrected = frame().assign(Au=[4.0, 3.0, 2.0, 1.0])
    raw = {
        "outputs_by_port": {
            "dataframe": dataframe_result(corrected),
            "report": {"report": [{"ok": True}]},
        }
    }
    normalized = apply_dataframe_contract(raw, {"input": source})
    again = apply_dataframe_contract(normalized, {"input": source})
    assert again is normalized
    assert normalized["_dataframe_contract_version"] == DATAFRAME_CONTRACT_VERSION
    port = normalized["outputs_by_port"]["dataframe"]
    assert port["_dataframe_contract_version"] == DATAFRAME_CONTRACT_VERSION
    assert dataframe_payload({"port": port}).id_column == "sample_id"


def test_filtering_and_id_switch_preserve_explicit_row_alignment() -> None:
    source = dataframe_result(frame(), id_column="sample_id")
    node = {"id": "select", "data": {"label": "Select"}}
    result = SelectColumnsNode().run(
        node,
        {"data": source, "_by_port": {"data": [source]}},
        {
            "mode": "select",
            "columns": ["Au"],
            "id_column": "batch_id",
            "row_query": "Au >= 2",
            "row_start": None,
            "row_end": None,
        },
        RuntimeContext(execution_id="test"),
    )
    payload = dataframe_payload({"result": apply_dataframe_contract(result, {"input": source})})
    assert payload.id_column == "batch_id"
    assert payload.df.columns.tolist() == ["batch_id", "Au"]
    assert payload.df["batch_id"].tolist() == ["b1", "b2", "b2"]
    assert calculation_columns(payload.df) == ["Au"]


def test_sort_then_reset_uses_unique_id_values_instead_of_positional_guessing() -> None:
    source = dataframe_result(frame(), id_column="sample_id")
    sorted_reset = frame().sort_values("Au", ascending=False).reset_index(drop=True)
    normalized = apply_dataframe_contract({"_df": sorted_reset}, {"input": source})
    payload = dataframe_payload({"result": normalized})
    assert payload.row_keys.tolist() == [3, 2, 1, 0]
    switched = payload.with_id_column("batch_id")
    assert switched.df["batch_id"].tolist() == ["b2", "b2", "b1", "b1"]


def test_aggregation_resets_lineage_intentionally() -> None:
    source = dataframe_result(frame(), id_column="sample_id")
    aggregate = pd.DataFrame({"group": ["b1", "b2"], "mean_Au": [1.5, 3.5]})
    normalized = apply_dataframe_contract(
        dataframe_result(aggregate, id_column="group", reset_lineage=True),
        {"input": source},
    )
    payload = dataframe_payload({"result": normalized})
    assert payload.id_column == "group"
    assert payload.source_columns == ["group", "mean_Au"]


def test_cache_round_trip_preserves_dataframe_contract(tmp_path) -> None:
    source_path = tmp_path / "source.csv"
    frame().to_csv(source_path, index=False)
    source = dataframe_result(frame(), id_column="sample_id", source_ref=source_path)
    normalized = apply_dataframe_contract(source, {})
    path = tmp_path / "result.joblib"
    joblib.dump(normalized, path, compress=3)
    cached = joblib.load(path)
    left = dataframe_payload({"value": normalized})
    right = dataframe_payload({"value": cached})
    pd.testing.assert_frame_equal(left.df, right.df)
    assert left.public_meta() == right.public_meta()
    assert left.row_keys.equals(right.row_keys)
    assert right.lineage._source_df is None
    assert right.with_id_column("batch_id").df["batch_id"].tolist() == ["b1", "b1", "b2", "b2"]


def test_lineage_copy_benchmark_is_constant_time_relative_to_source_size() -> None:
    large = pd.DataFrame({
        "sample_id": [f"s{index}" for index in range(100_000)],
        **{f"x{column}": range(100_000) for column in range(12)},
    })
    payload = dataframe_payload({"value": dataframe_result(large, id_column="sample_id")})
    started = time.perf_counter()
    copies = [payload.copy() for _ in range(1_000)]
    elapsed = time.perf_counter() - started
    assert all(item.lineage is payload.lineage and item.df is payload.df for item in copies)
    assert elapsed < 2.0
