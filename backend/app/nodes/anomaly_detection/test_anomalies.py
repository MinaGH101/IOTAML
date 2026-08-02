"""Regression tests for dual-dataframe anomaly mapping and class outputs."""

from __future__ import annotations

import unittest

import pandas as pd

from app.nodes.anomaly_detection.anomalies import DualDataAnomalyDetector


class DualDataAnomalyDetectorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.normalized = pd.DataFrame({
            "sample_id": ["S1", "S2", "S3", "S4", "S5"],
            "Ln_Au": [-1.0, -0.5, 0.0, 0.5, 5.0],
            "Ln_Cu": [0.0, 0.1, 0.2, 0.3, 0.4],
        })
        self.raw = pd.DataFrame({
            "sample_id": ["S3", "S1", "S5", "S2", "S4"],
            "raw_Au": [20.0, 5.0, 500.0, 10.0, 30.0],
            "raw_Cu": [100.0, 80.0, 140.0, 90.0, 120.0],
        })

    def detector(self) -> DualDataAnomalyDetector:
        return DualDataAnomalyDetector(
            self.normalized,
            self.raw,
            calculation_id_column="sample_id",
            detection_id_column="sample_id",
            columns=["Ln_Au", "Ln_Cu"],
        )

    def test_zscore_uses_normalized_membership_and_returns_raw_values(self) -> None:
        result = self.detector().zscore([1, 2, 3], tail="upper", ddof=1)
        au_records = [
            record for record in result.anomaly_records
            if record["column"] == "Au"
        ]

        self.assertEqual(len(au_records), 1)
        self.assertEqual(au_records[0]["sample"], "S5")
        self.assertEqual(au_records[0]["value"], 500.0)
        self.assertEqual(au_records[0]["calculation_value"], 5.0)
        self.assertEqual(result.alignment, "id")

    def test_n_prefix_maps_to_the_same_detection_column(self) -> None:
        normalized_detection = self.raw.rename(
            columns={"raw_Au": "N_Au", "raw_Cu": "N_Cu"}
        )
        detector = DualDataAnomalyDetector(
            self.normalized.rename(columns={"Ln_Au": "Au", "Ln_Cu": "Cu"}),
            normalized_detection,
            calculation_id_column="sample_id",
            detection_id_column="sample_id",
            columns=["Au", "Cu"],
        )
        result = detector.zscore([1], tail="upper", ddof=1)
        self.assertEqual(result.column_pairs[0].detection_column, "N_Au")
        self.assertEqual(result.column_pairs[1].detection_column, "N_Cu")

    def test_same_dataframe_maps_exact_columns_without_scope_error(self) -> None:
        detector = DualDataAnomalyDetector(
            self.normalized,
            self.normalized,
            calculation_id_column="sample_id",
            detection_id_column="sample_id",
            columns=["Ln_Au", "Ln_Cu"],
        )
        result = detector.zscore([1], tail="upper", ddof=1)
        self.assertEqual(result.column_pairs[0].detection_column, "Ln_Au")
        self.assertEqual(result.column_pairs[1].detection_column, "Ln_Cu")

    def test_numeric_string_detection_columns_are_supported(self) -> None:
        detection = self.raw.copy()
        detection["raw_Au"] = detection["raw_Au"].astype(str)
        detection["raw_Cu"] = detection["raw_Cu"].astype(str)
        result = DualDataAnomalyDetector(
            self.normalized,
            detection,
            calculation_id_column="sample_id",
            detection_id_column="sample_id",
            columns=["Ln_Au", "Ln_Cu"],
        ).zscore([1], tail="upper", ddof=1)
        self.assertEqual(result.column_pairs[0].detection_column, "raw_Au")
        self.assertIsInstance(result.anomaly_records[0]["value"], float)

    def test_non_numeric_detection_dataframe_has_clear_error(self) -> None:
        detection = pd.DataFrame({
            "sample_id": ["S1", "S2", "S3", "S4", "S5"],
            "description": ["a", "b", "c", "d", "e"],
        })
        with self.assertRaisesRegex(
            ValueError,
            "has no numeric or numeric-like value columns",
        ):
            DualDataAnomalyDetector(
                self.normalized,
                detection,
                calculation_id_column="sample_id",
                detection_id_column="sample_id",
                columns=["Ln_Au"],
            )

    def test_counts_include_zero_rows_for_bar_plot(self) -> None:
        result = self.detector().zscore([1, 2, 3], tail="upper", ddof=1)
        self.assertEqual(len(result.count_rows), 6)
        self.assertEqual(
            {row["class"] for row in result.count_rows},
            {"X + 1S", "X + 2S", "X + 3S"},
        )
        self.assertTrue(any(row["count"] == 0 for row in result.count_rows))

    def test_class_tables_are_wide_sample_value_pairs(self) -> None:
        result = self.detector().zscore([1, 2, 3], tail="upper", ddof=1)
        table = result.class_tables["X + 1S"]
        self.assertEqual(
            list(table.columns),
            ["Au__sample", "Au", "Cu__sample", "Cu"],
        )

    def test_count_table_is_wide_and_bar_plot_ready(self) -> None:
        result = self.detector().zscore([1, 2, 3], tail="upper", ddof=1)
        self.assertEqual(list(result.count_table.columns), ["class", "Au", "Cu"])
        self.assertEqual(result.count_table["class"].tolist(), result.classes)

    def test_same_source_duplicate_metadata_ids_do_not_break_alignment(self) -> None:
        repeated = self.normalized.copy()
        repeated["sample_id"] = ["A", "A", "B", "B", "C"]
        result = DualDataAnomalyDetector(
            repeated,
            repeated,
            calculation_id_column="sample_id",
            detection_id_column="sample_id",
            columns=["Ln_Au"],
        ).zscore([1], tail="upper", ddof=1)
        self.assertEqual(result.alignment, "same_source_position")

    def test_iqr_returns_exclusive_classes(self) -> None:
        result = self.detector().iqr([1.5, 3], tail="both")
        keys = [
            (record["sample"], record["column"])
            for record in result.anomaly_records
        ]
        self.assertEqual(len(keys), len(set(keys)))

    def test_manual_thresholds_classify_on_calculation_data(self) -> None:
        result = self.detector().manual([0.25, 2], operator=">")
        au_records = [
            record for record in result.anomaly_records
            if record["column"] == "Au"
        ]
        self.assertEqual(
            {(record["sample"], record["value"]) for record in au_records},
            {("S4", 30.0), ("S5", 500.0)},
        )

    def test_missing_detection_ids_fail_instead_of_silent_misalignment(self) -> None:
        missing = self.raw[self.raw["sample_id"] != "S5"].copy()
        with self.assertRaisesRegex(ValueError, "absent from detection data"):
            DualDataAnomalyDetector(
                self.normalized,
                missing,
                calculation_id_column="sample_id",
                detection_id_column="sample_id",
                columns=["Ln_Au"],
            )


if __name__ == "__main__":
    unittest.main()
