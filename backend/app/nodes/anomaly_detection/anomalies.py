"""Shared anomaly-detection engine for two-dataframe workflows.

The *calculation dataframe* determines which samples belong to anomaly classes.
The *detection dataframe* supplies the values reported for those same samples.
Columns are matched by exact name first and then by a canonical name that
removes known transformation prefixes such as ``N_``, ``raw_`` and ``Ln_``.
Rows are aligned by propagated workflow IDs whenever ID columns are available.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Sequence

import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype

_COLUMN_PREFIXES = (
    "normalized_",
    "standardized_",
    "raw_",
    "n_",
    "ln_",
    "log10_",
    "log_",
    "bc_",
    "r_",
)


def _json_value(value: Any) -> Any:
    """Convert pandas/NumPy scalar values into JSON-safe Python values."""
    if pd.isna(value):
        return None
    if isinstance(value, np.generic):
        return value.item()
    return value


def _numeric_json_value(value: Any) -> Any:
    """Convert one known numeric-compatible value to a JSON-safe number."""
    return _json_value(pd.to_numeric(value, errors="coerce"))


def _number_label(value: float) -> str:
    return f"{float(value):g}"


def _slug(value: str) -> str:
    cleaned = "".join(character.lower() if character.isalnum() else "_" for character in value)
    return "_".join(part for part in cleaned.split("_") if part)


def canonical_column_name(column: str) -> str:
    """Return the base variable name used to match transformed columns."""
    name = str(column).strip()
    lowered = name.lower()
    for prefix in _COLUMN_PREFIXES:
        if lowered.startswith(prefix):
            return name[len(prefix):]
    return name


def _numeric_columns(df: pd.DataFrame, id_column: str | None) -> list[str]:
    """Return native-numeric and safely numeric-like columns.

    CSV and intermediate workflow outputs can carry numbers with ``object`` or
    pandas string dtype. Restricting detection to ``np.number`` made a valid
    dataframe look as if it had no columns. A non-native column is accepted only
    when every non-empty value can be converted to a number.
    """
    excluded = str(id_column or "")
    compatible: list[str] = []
    for raw_column in df.columns:
        column = str(raw_column)
        if column == excluded:
            continue
        series = df[raw_column]
        if is_numeric_dtype(series.dtype):
            compatible.append(column)
            continue
        non_empty = series.dropna()
        if non_empty.empty:
            continue
        converted = pd.to_numeric(non_empty, errors="coerce")
        if converted.notna().all():
            compatible.append(column)
    return compatible


def _normalise_id(value: Any) -> str:
    if pd.isna(value):
        raise ValueError("ID columns cannot contain empty values.")
    if isinstance(value, (int, np.integer)):
        return str(int(value))
    if isinstance(value, (float, np.floating)) and float(value).is_integer():
        return str(int(value))
    return str(value).strip()


@dataclass(frozen=True)
class ColumnPair:
    """Resolved calculation/detection columns for one logical variable."""

    calculation_column: str
    detection_column: str
    label: str


@dataclass
class AnomalyResult:
    """All machine-readable and UI-ready outputs produced by one detector run."""

    detection_dataframe: pd.DataFrame
    calculation_id_column: str | None
    detection_id_column: str | None
    threshold_rows: list[dict[str, Any]]
    anomaly_records: list[dict[str, Any]]
    count_rows: list[dict[str, Any]]
    class_tables: dict[str, pd.DataFrame]
    classes: list[str]
    column_pairs: list[ColumnPair]
    alignment: str

    @property
    def threshold_table(self) -> pd.DataFrame:
        return pd.DataFrame(self.threshold_rows)

    @property
    def count_table(self) -> pd.DataFrame:
        """Return one row per class and one numeric count column per variable."""
        rows_by_class = {
            anomaly_class: {"class": anomaly_class}
            for anomaly_class in self.classes
        }
        for record in self.count_rows:
            rows_by_class[str(record["class"])][str(record["column"])] = int(record["count"])
        ordered_columns = ["class", *[pair.label for pair in self.column_pairs]]
        return pd.DataFrame(
            [rows_by_class[anomaly_class] for anomaly_class in self.classes],
            columns=ordered_columns,
        ).fillna(0)

    @property
    def class_column_labels(self) -> dict[str, str]:
        """Map unique transport keys to the repeated labels required by the UI."""
        labels: dict[str, str] = {}
        for pair in self.column_pairs:
            labels[f"{pair.label}__sample"] = "samples"
            labels[pair.label] = pair.label
        return labels

    def report(self) -> dict[str, Any]:
        return {
            "calculation_id_column": self.calculation_id_column,
            "detection_id_column": self.detection_id_column,
            "alignment": self.alignment,
            "classes": self.classes,
            "column_pairs": [
                {
                    "column": pair.label,
                    "calculation_column": pair.calculation_column,
                    "detection_column": pair.detection_column,
                }
                for pair in self.column_pairs
            ],
            "thresholds": self.threshold_rows,
            "anomalies": self.anomaly_records,
            "counts": self.count_rows,
            "total_anomalies": len(self.anomaly_records),
        }


class DualDataAnomalyDetector:
    """
    Calculate anomaly classes on one dataframe and return values from another.

    Rows are aligned by the propagated workflow ID columns. Positional alignment
    is used only when neither input carries an ID and both frames have equal
    lengths.
    """

    def __init__(
        self,
        calculation_dataframe: pd.DataFrame,
        detection_dataframe: pd.DataFrame | None = None,
        *,
        calculation_id_column: str | None = None,
        detection_id_column: str | None = None,
        columns: Sequence[str] | None = None,
    ) -> None:
        self.same_dataframe_input = (
            detection_dataframe is None
            or detection_dataframe is calculation_dataframe
        )
        self.calculation_df = calculation_dataframe.copy()
        self.detection_df = (
            detection_dataframe.copy()
            if detection_dataframe is not None
            else calculation_dataframe.copy()
        )
        self.calculation_id_column = calculation_id_column or None
        self.detection_id_column = detection_id_column or None
        self.pairs = self._resolve_pairs(columns)
        self.detection_positions, self.alignment = self._build_alignment()

    def _resolve_pairs(self, selected: Sequence[str] | None) -> list[ColumnPair]:
        """Resolve selected calculation columns against the detection frame.

        Resolution order:
        1. exact column-name match;
        2. one unique canonical-name match after removing known prefixes.

        Numeric-like string columns are allowed. Ambiguous or absent mappings
        fail immediately instead of silently pairing unrelated variables.
        """
        calculation_columns = _numeric_columns(self.calculation_df, self.calculation_id_column)
        requested = [str(column) for column in (selected or []) if str(column)]
        if requested:
            missing = [column for column in requested if column not in calculation_columns]
            if missing:
                raise ValueError(
                    "Calculation columns were not found: " + ", ".join(missing)
                )
            calculation_columns = requested
        if not calculation_columns:
            raise ValueError("Select at least one numeric threshold-calculation column.")

        detection_columns = _numeric_columns(self.detection_df, self.detection_id_column)
        if not detection_columns:
            dtype_summary = {
                str(column): str(dtype)
                for column, dtype in self.detection_df.dtypes.items()
                if str(column) != str(self.detection_id_column or "")
            }
            raise ValueError(
                "The selected anomaly-detection dataframe has no numeric or "
                f"numeric-like value columns. Available columns and dtypes: {dtype_summary}."
            )
        by_canonical: dict[str, list[str]] = {}
        for column in detection_columns:
            by_canonical.setdefault(canonical_column_name(column).casefold(), []).append(column)

        pairs: list[ColumnPair] = []
        labels: set[str] = set()
        for calculation_column in calculation_columns:
            canonical = canonical_column_name(calculation_column)
            if calculation_column in detection_columns:
                detection_column = calculation_column
            else:
                candidates = by_canonical.get(canonical.casefold(), [])
                if len(candidates) != 1:
                    detail = "none" if not candidates else ", ".join(candidates)
                    raise ValueError(
                        f"Cannot uniquely map calculation column '{calculation_column}' "
                        f"to the detection dataframe. "
                        f"Calculation columns: {calculation_columns}. "
                        f"Detection columns: {detection_columns}. "
                        f"Canonical name: '{canonical}'. "
                        f"Canonical matches: {detail}."
                    )
                detection_column = candidates[0]
            if canonical.casefold() in labels:
                raise ValueError(
                    f"Multiple selected calculation columns resolve to '{canonical}'."
                )
            labels.add(canonical.casefold())
            pairs.append(ColumnPair(calculation_column, detection_column, canonical))
        return pairs

    def _build_alignment(self) -> tuple[list[int], str]:
        calculation_id = self.calculation_id_column
        detection_id = self.detection_id_column
        if calculation_id and calculation_id not in self.calculation_df.columns:
            raise ValueError(f"Calculation ID column '{calculation_id}' was not found.")
        if detection_id and detection_id not in self.detection_df.columns:
            raise ValueError(f"Detection ID column '{detection_id}' was not found.")

        # Selecting the same connected dataframe for both roles is already
        # perfectly aligned. Duplicate values in a metadata ID column must not
        # turn a valid same-source calculation into a false alignment error.
        if self.same_dataframe_input and len(self.calculation_df) == len(self.detection_df):
            return list(range(len(self.calculation_df))), "same_source_position"

        if calculation_id and detection_id:
            calculation_keys = [
                _normalise_id(value)
                for value in self.calculation_df[calculation_id].tolist()
            ]
            detection_keys = [
                _normalise_id(value)
                for value in self.detection_df[detection_id].tolist()
            ]
            if len(set(calculation_keys)) != len(calculation_keys):
                duplicates = pd.Series(calculation_keys)[
                    pd.Series(calculation_keys).duplicated(keep=False)
                ].drop_duplicates().head(5).tolist()
                raise ValueError(
                    f"Calculation ID column '{calculation_id}' contains duplicate "
                    f"values: {duplicates}. Different dataframes require a unique ID."
                )
            if len(set(detection_keys)) != len(detection_keys):
                duplicates = pd.Series(detection_keys)[
                    pd.Series(detection_keys).duplicated(keep=False)
                ].drop_duplicates().head(5).tolist()
                raise ValueError(
                    f"Detection ID column '{detection_id}' contains duplicate "
                    f"values: {duplicates}. Different dataframes require a unique ID."
                )
            detection_lookup = {
                key: position for position, key in enumerate(detection_keys)
            }
            missing = [key for key in calculation_keys if key not in detection_lookup]
            if missing:
                preview = ", ".join(missing[:5])
                raise ValueError(
                    f"{len(missing)} calculation samples are absent from detection data: {preview}"
                )
            return [detection_lookup[key] for key in calculation_keys], "id"

        if calculation_id or detection_id:
            raise ValueError(
                "Both inputs must provide an ID column, or neither input may provide one."
            )
        if len(self.calculation_df) != len(self.detection_df):
            raise ValueError(
                "Without ID columns, calculation and detection data must have equal row counts."
            )
        return list(range(len(self.calculation_df))), "position"

    def _build_result(
        self,
        threshold_rows: list[dict[str, Any]],
        classes: list[str],
        assignments: dict[str, list[str | None]],
    ) -> AnomalyResult:
        output_df = self.detection_df.copy()
        anomaly_records: list[dict[str, Any]] = []
        count_rows: list[dict[str, Any]] = []
        records_by_class_and_column: dict[tuple[str, str], list[dict[str, Any]]] = {}

        for pair in self.pairs:
            pair_assignments = assignments[pair.calculation_column]
            for anomaly_class in classes:
                calculation_positions = [
                    position
                    for position, assigned in enumerate(pair_assignments)
                    if assigned == anomaly_class
                ]
                detection_positions = [
                    self.detection_positions[position]
                    for position in calculation_positions
                ]
                flags = np.zeros(len(output_df), dtype=bool)
                flags[detection_positions] = True
                output_df[
                    f"{pair.label}_{_slug(anomaly_class)}_anomaly"
                ] = flags

                class_records: list[dict[str, Any]] = []
                for calculation_position, detection_position in zip(
                    calculation_positions,
                    detection_positions,
                ):
                    calculation_row = self.calculation_df.iloc[calculation_position]
                    detection_row = self.detection_df.iloc[detection_position]
                    sample_id = (
                        _json_value(detection_row[self.detection_id_column])
                        if self.detection_id_column
                        else _json_value(self.detection_df.index[detection_position])
                    )
                    record = {
                        "sample": sample_id,
                        "row_index": _json_value(self.detection_df.index[detection_position]),
                        "column": pair.label,
                        "calculation_column": pair.calculation_column,
                        "detection_column": pair.detection_column,
                        "class": anomaly_class,
                        "calculation_value": _numeric_json_value(
                            calculation_row[pair.calculation_column]
                        ),
                        "value": _numeric_json_value(
                            detection_row[pair.detection_column]
                        ),
                    }
                    anomaly_records.append(record)
                    class_records.append(record)
                records_by_class_and_column[(anomaly_class, pair.label)] = class_records
                count_rows.append(
                    {
                        "column": pair.label,
                        "calculation_column": pair.calculation_column,
                        "detection_column": pair.detection_column,
                        "class": anomaly_class,
                        "count": len(class_records),
                    }
                )

        class_tables: dict[str, pd.DataFrame] = {}
        for anomaly_class in classes:
            columns: dict[str, pd.Series] = {}
            for pair in self.pairs:
                records = records_by_class_and_column[(anomaly_class, pair.label)]
                columns[f"{pair.label}__sample"] = pd.Series(
                    [record["sample"] for record in records],
                    dtype="object",
                )
                columns[pair.label] = pd.Series(
                    [record["value"] for record in records],
                    dtype="object",
                )
            class_tables[anomaly_class] = pd.DataFrame(columns)

        return AnomalyResult(
            detection_dataframe=output_df,
            calculation_id_column=self.calculation_id_column,
            detection_id_column=self.detection_id_column,
            threshold_rows=threshold_rows,
            anomaly_records=anomaly_records,
            count_rows=count_rows,
            class_tables=class_tables,
            classes=classes,
            column_pairs=self.pairs,
            alignment=self.alignment,
        )

    def zscore(
        self,
        multipliers: Iterable[float],
        *,
        center_method: str = "mean",
        tail: str = "upper",
        ddof: int = 1,
    ) -> AnomalyResult:
        values = sorted({float(value) for value in multipliers if float(value) > 0})
        if not values:
            raise ValueError("Enter at least one positive standard-deviation multiplier.")
        if center_method not in {"mean", "median"}:
            raise ValueError("Center method must be 'mean' or 'median'.")
        if tail not in {"upper", "lower", "both"}:
            raise ValueError("Tail must be 'upper', 'lower', or 'both'.")

        upper_classes = [f"X + {_number_label(value)}S" for value in values]
        lower_classes = [f"X - {_number_label(value)}S" for value in values]
        classes = (
            upper_classes
            if tail == "upper"
            else lower_classes
            if tail == "lower"
            else upper_classes + lower_classes
        )
        threshold_rows: list[dict[str, Any]] = [
            {"class": anomaly_class}
            for anomaly_class in classes
        ]
        assignments: dict[str, list[str | None]] = {}

        for pair in self.pairs:
            series = pd.to_numeric(
                self.calculation_df[pair.calculation_column],
                errors="coerce",
            )
            valid = series.dropna()
            if valid.empty:
                raise ValueError(
                    f"Calculation column '{pair.calculation_column}' has no numeric values."
                )
            center = float(valid.mean() if center_method == "mean" else valid.median())
            std = float(valid.std(ddof=ddof)) if len(valid) > ddof else 0.0
            thresholds: dict[str, float] = {}
            for multiplier, anomaly_class in zip(values, upper_classes):
                thresholds[anomaly_class] = center + multiplier * std
            for multiplier, anomaly_class in zip(values, lower_classes):
                thresholds[anomaly_class] = center - multiplier * std
            for row in threshold_rows:
                row[pair.label] = round(float(thresholds[row["class"]]), 8)

            assigned: list[str | None] = [None] * len(series)
            if std > 0:
                for position, raw_value in enumerate(series.tolist()):
                    if pd.isna(raw_value):
                        continue
                    value = float(raw_value)
                    if tail in {"upper", "both"}:
                        for multiplier, anomaly_class in reversed(
                            list(zip(values, upper_classes))
                        ):
                            if value > center + multiplier * std:
                                assigned[position] = anomaly_class
                                break
                    if assigned[position] is None and tail in {"lower", "both"}:
                        for multiplier, anomaly_class in reversed(
                            list(zip(values, lower_classes))
                        ):
                            if value < center - multiplier * std:
                                assigned[position] = anomaly_class
                                break
            assignments[pair.calculation_column] = assigned

        return self._build_result(threshold_rows, classes, assignments)

    def iqr(
        self,
        multipliers: Iterable[float],
        *,
        tail: str = "both",
    ) -> AnomalyResult:
        values = sorted({float(value) for value in multipliers if float(value) > 0})
        if not values:
            raise ValueError("Enter at least one positive IQR multiplier.")
        if tail not in {"upper", "lower", "both"}:
            raise ValueError("Tail must be 'upper', 'lower', or 'both'.")

        lower_classes = [f"Q1 - {_number_label(value)}IQR" for value in values]
        upper_classes = [f"Q3 + {_number_label(value)}IQR" for value in values]
        classes = (
            upper_classes
            if tail == "upper"
            else lower_classes
            if tail == "lower"
            else lower_classes + upper_classes
        )
        threshold_rows: list[dict[str, Any]] = [
            {"class": anomaly_class}
            for anomaly_class in classes
        ]
        assignments: dict[str, list[str | None]] = {}

        for pair in self.pairs:
            series = pd.to_numeric(
                self.calculation_df[pair.calculation_column],
                errors="coerce",
            )
            valid = series.dropna()
            if valid.empty:
                raise ValueError(
                    f"Calculation column '{pair.calculation_column}' has no numeric values."
                )
            q1 = float(valid.quantile(0.25))
            q3 = float(valid.quantile(0.75))
            iqr = q3 - q1
            thresholds: dict[str, float] = {}
            for multiplier, anomaly_class in zip(values, lower_classes):
                thresholds[anomaly_class] = q1 - multiplier * iqr
            for multiplier, anomaly_class in zip(values, upper_classes):
                thresholds[anomaly_class] = q3 + multiplier * iqr
            for row in threshold_rows:
                row[pair.label] = round(float(thresholds[row["class"]]), 8)

            assigned: list[str | None] = [None] * len(series)
            if iqr > 0:
                for position, raw_value in enumerate(series.tolist()):
                    if pd.isna(raw_value):
                        continue
                    value = float(raw_value)
                    if tail in {"upper", "both"}:
                        for multiplier, anomaly_class in reversed(
                            list(zip(values, upper_classes))
                        ):
                            if value > q3 + multiplier * iqr:
                                assigned[position] = anomaly_class
                                break
                    if assigned[position] is None and tail in {"lower", "both"}:
                        for multiplier, anomaly_class in reversed(
                            list(zip(values, lower_classes))
                        ):
                            if value < q1 - multiplier * iqr:
                                assigned[position] = anomaly_class
                                break
            assignments[pair.calculation_column] = assigned

        return self._build_result(threshold_rows, classes, assignments)

    def manual(
        self,
        thresholds: Iterable[float],
        *,
        operator: str,
    ) -> AnomalyResult:
        values = sorted({float(value) for value in thresholds})
        if not values:
            raise ValueError("Enter at least one manual threshold.")
        if operator not in {">", ">=", "<", "<=", "==", "!="}:
            raise ValueError("Unsupported threshold operator.")
        ordered = list(reversed(values)) if operator in {">", ">="} else values
        classes = [f"{operator} {_number_label(value)}" for value in ordered]
        threshold_rows = [{"class": anomaly_class} for anomaly_class in classes]
        assignments: dict[str, list[str | None]] = {}

        def matches(value: float, threshold: float) -> bool:
            return {
                ">": value > threshold,
                ">=": value >= threshold,
                "<": value < threshold,
                "<=": value <= threshold,
                "==": value == threshold,
                "!=": value != threshold,
            }[operator]

        for pair in self.pairs:
            for row, threshold in zip(threshold_rows, ordered):
                row[pair.label] = threshold
            series = pd.to_numeric(
                self.calculation_df[pair.calculation_column],
                errors="coerce",
            )
            if series.dropna().empty:
                raise ValueError(
                    f"Calculation column '{pair.calculation_column}' has no numeric values."
                )
            assigned: list[str | None] = [None] * len(series)
            for position, raw_value in enumerate(series.tolist()):
                if pd.isna(raw_value):
                    continue
                for threshold, anomaly_class in zip(ordered, classes):
                    if matches(float(raw_value), threshold):
                        assigned[position] = anomaly_class
                        break
            assignments[pair.calculation_column] = assigned

        return self._build_result(threshold_rows, classes, assignments)


class AnomalyDetection:
    """Backward-compatible service wrapper around the dual-data detector."""

    def __init__(
        self,
        data_json: Any,
        method: str = "zscore",
        with_ginsberg_fitering: bool = False,
        *,
        detection_data_json: Any | None = None,
        calculation_id_column: str | None = None,
        detection_id_column: str | None = None,
        columns: Sequence[str] | None = None,
    ) -> None:
        if method not in {"zscore", "iqr"}:
            raise ValueError("method must be 'zscore' or 'iqr'")
        self.data_json = data_json
        self.detection_data_json = detection_data_json
        self.method = method
        self.with_ginsberg_fitering = with_ginsberg_fitering
        self.calculation_id_column = calculation_id_column
        self.detection_id_column = detection_id_column
        self.columns = columns

    @staticmethod
    def _split_combined(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
        meta_columns = [
            column
            for column in ("Description", "Description_n", "Elevation", "Lon", "Lat")
            if column in df.columns
        ]
        raw_columns = [column for column in df.columns if str(column).lower().startswith("raw_")]
        calculation_columns = [
            column
            for column in df.columns
            if str(column).lower().startswith(("ln_", "bc_", "r_"))
        ]
        if not raw_columns or not calculation_columns:
            return df.copy(), df.copy()
        return (
            df[meta_columns + calculation_columns].copy(),
            df[meta_columns + raw_columns].copy(),
        )

    def run(
        self,
        elements_for_plot: list[str] | None = None,
        *,
        multipliers: Sequence[float] | None = None,
        tail: str | None = None,
    ) -> dict[str, Any]:
        calculation_df = pd.DataFrame(self.data_json)
        if self.detection_data_json is None:
            calculation_df, detection_df = self._split_combined(calculation_df)
        else:
            detection_df = pd.DataFrame(self.detection_data_json)

        columns = self.columns or elements_for_plot
        detector = DualDataAnomalyDetector(
            calculation_df,
            detection_df,
            calculation_id_column=self.calculation_id_column,
            detection_id_column=self.detection_id_column,
            columns=columns,
        )
        if self.method == "zscore":
            result = detector.zscore(
                multipliers or [1.0, 2.0, 3.0],
                tail=tail or "upper",
            )
        else:
            result = detector.iqr(
                multipliers or [1.5, 3.0],
                tail=tail or "both",
            )

        thresholds_by_column: dict[str, dict[str, Any]] = {}
        for row in result.threshold_rows:
            for pair in result.column_pairs:
                thresholds_by_column.setdefault(pair.label, {})[row["class"]] = row[pair.label]
        anomalies_by_class: dict[str, list[dict[str, Any]]] = {}
        for anomaly_class, table in result.class_tables.items():
            anomalies_by_class[anomaly_class] = table.where(pd.notna(table), None).to_dict("records")
        return {
            "anomaly_classes": thresholds_by_column,
            "detected_anomalies": anomalies_by_class,
            "plot_data": [
                {
                    "Element": row["column"],
                    "Class": row["class"],
                    "Count": row["count"],
                }
                for row in result.count_rows
            ],
            "threshold_table": result.threshold_rows,
            "anomaly_tables": anomalies_by_class,
            "count_table": result.count_rows,
            "report": result.report(),
        }
