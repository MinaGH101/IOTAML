from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import coerce_numeric_series, dataframe_payload, dataframe_result, ensure_df, node_label, numeric_df, output, selected_columns, table_output


@dataclass
class TailResult:
    boundary: float | None
    cut_index: int | None
    gap: float | None
    threshold: float | None


def _robust_gap_threshold(gaps: np.ndarray, sensitivity: float) -> float:
    finite = gaps[np.isfinite(gaps)]
    if finite.size == 0:
        return float('inf')
    center = float(np.median(finite))
    mad = float(np.median(np.abs(finite - center)))
    scale = 1.4826 * mad
    percentile_floor = float(np.quantile(finite, 0.90)) if finite.size >= 4 else center
    return max(center + sensitivity * scale, percentile_floor * max(1.0, sensitivity / 3.0), np.finfo(float).eps)


def _tail_cut(values: np.ndarray, *, side: str, sensitivity: float, max_fraction: float, min_regular: int) -> TailResult:
    size = len(values)
    if size < max(5, min_regular + 1):
        return TailResult(None, None, None, None)
    gaps = np.diff(values)
    central_start = max(0, int(size * max_fraction) - 1)
    central_end = min(len(gaps), int(size * (1.0 - max_fraction)))
    baseline = gaps[central_start:central_end] if central_end > central_start else gaps
    threshold = _robust_gap_threshold(baseline, sensitivity)
    max_outliers = max(1, int(np.floor(size * max_fraction)))

    if side == 'upper':
        candidates = range(max(min_regular - 1, size - max_outliers - 1), size - 1)
    else:
        candidates = range(0, min(max_outliers, size - min_regular))
    eligible = [(index, float(gaps[index])) for index in candidates if np.isfinite(gaps[index]) and gaps[index] > threshold]
    if not eligible:
        return TailResult(None, None, None, threshold)
    cut_index, gap = max(eligible, key=lambda item: item[1])
    boundary = float(values[cut_index] if side == 'upper' else values[cut_index + 1])
    return TailResult(boundary, cut_index, gap, threshold)


def _replacement_value(mode: str, clean_values: pd.Series, boundary: float, side: str) -> float | None:
    if mode == 'nearest_boundary':
        return boundary
    if mode == 'median':
        return float(clean_values.median())
    if mode == 'missing':
        return None
    if mode == 'keep':
        return None
    raise ValueError('Replacement must be keep, nearest_boundary, median, or missing.')


class SortedGapOutlierNode(BaseNode):
    id = 'AD-005'
    name = 'Sorted Gap Outlier'
    category = 'Anomaly Detection'
    description = 'Detects abrupt low- or high-tail jumps in sorted numeric values and optionally coerces them to the nearest non-outlier boundary.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [
        port('dataframe', 'Corrected DataFrame', 'dataframe'),
        port('report', 'Outlier Report', 'dataframe'),
        port('plot', 'Sorted Stair Plots', 'plot'),
    ]
    settings_schema = [
        setting('columns', 'Columns', 'columns', [], True),
        setting('tail', 'Tail', 'select', 'both', options=['both', 'upper', 'lower']),
        setting('sensitivity', 'Gap Sensitivity', 'float', 5.0, help='Higher values detect only more abrupt tail jumps.'),
        setting('max_outlier_fraction', 'Maximum Outlier Fraction', 'float', 0.10, help='Maximum fraction considered at each tail.'),
        setting('minimum_regular_values', 'Minimum Retained Values', 'integer', 5),
        setting('replacement', 'Replacement', 'select', 'nearest_boundary', options=['keep', 'nearest_boundary', 'median', 'missing']),
        setting('add_flag_columns', 'Add Outlier Flag Columns', 'boolean', True),
        setting('max_plot_points', 'Max Plot Points', 'integer', 2000),
        setting('color', 'Color', 'color', '#31cde3', supports_dynamic=False),
    ]
    cache_version = '2'

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        source = ensure_df(payload.df if payload else None, str(node['id']))
        corrected = source.copy()
        selected = selected_columns(settings, source)
        if not selected:
            selected = list(numeric_df(source).columns)
        selected = [column for column in selected if column in source.columns]
        if not selected:
            raise ValueError('Select at least one numeric column for sorted-gap outlier detection.')

        tail = str(settings.get('tail') or 'both')
        sensitivity = max(0.5, float(settings.get('sensitivity') or 5.0))
        max_fraction = min(0.45, max(0.001, float(settings.get('max_outlier_fraction') or 0.10)))
        min_regular = max(3, int(settings.get('minimum_regular_values') or 5))
        replacement = str(settings.get('replacement') or 'nearest_boundary')
        add_flags = bool(settings.get('add_flag_columns', True))
        max_plot_points = max(50, min(10000, int(settings.get('max_plot_points') or 2000)))
        color = str(settings.get('color') or '#31cde3')

        reports: list[dict[str, Any]] = []
        outlier_rows: list[dict[str, Any]] = []
        plots: list[dict[str, Any]] = []
        for column in selected:
            numeric = coerce_numeric_series(source, column)
            valid = numeric.dropna().sort_values(kind='mergesort')
            if len(valid) < max(5, min_regular + 1):
                reports.append({'column': column, 'valid_values': int(len(valid)), 'lower_outliers': 0, 'upper_outliers': 0, 'message': 'insufficient_values'})
                continue
            sorted_values = valid.to_numpy(dtype=float)
            lower = _tail_cut(sorted_values, side='lower', sensitivity=sensitivity, max_fraction=max_fraction, min_regular=min_regular) if tail in {'both', 'lower'} else TailResult(None, None, None, None)
            upper = _tail_cut(sorted_values, side='upper', sensitivity=sensitivity, max_fraction=max_fraction, min_regular=min_regular) if tail in {'both', 'upper'} else TailResult(None, None, None, None)
            lower_mask = numeric < lower.boundary if lower.boundary is not None else pd.Series(False, index=source.index)
            upper_mask = numeric > upper.boundary if upper.boundary is not None else pd.Series(False, index=source.index)
            outlier_mask = (lower_mask | upper_mask).fillna(False)
            clean_values = numeric[~outlier_mask & numeric.notna()]

            replacement_series = numeric.copy()
            if replacement != 'keep' and not clean_values.empty:
                if lower.boundary is not None:
                    lower_value = _replacement_value(replacement, clean_values, lower.boundary, 'lower')
                    replacement_series.loc[lower_mask] = np.nan if lower_value is None else lower_value
                if upper.boundary is not None:
                    upper_value = _replacement_value(replacement, clean_values, upper.boundary, 'upper')
                    replacement_series.loc[upper_mask] = np.nan if upper_value is None else upper_value
                corrected.loc[numeric.notna(), column] = replacement_series.loc[numeric.notna()]
            if add_flags:
                corrected[f'{column}__sorted_gap_outlier'] = outlier_mask.astype(bool)

            for index in source.index[outlier_mask]:
                original_value = numeric.loc[index]
                outlier_rows.append({
                    'row_index': str(index),
                    'sample_id': source.loc[index, payload.id_column] if payload and payload.id_column in source.columns else None,
                    'column': column,
                    'tail': 'lower' if bool(lower_mask.loc[index]) else 'upper',
                    'original_value': float(original_value),
                    'replacement_value': None if replacement == 'keep' else (None if pd.isna(replacement_series.loc[index]) else float(replacement_series.loc[index])),
                })

            reports.append({
                'column': column,
                'valid_values': int(len(valid)),
                'lower_boundary': lower.boundary,
                'upper_boundary': upper.boundary,
                'lower_gap': lower.gap,
                'upper_gap': upper.gap,
                'lower_threshold': lower.threshold,
                'upper_threshold': upper.threshold,
                'lower_outliers': int(lower_mask.sum()),
                'upper_outliers': int(upper_mask.sum()),
                'replacement': replacement,
            })

            sorted_frame = pd.DataFrame({'value': numeric, 'corrected': replacement_series, 'is_outlier': outlier_mask}).dropna(subset=['value']).sort_values('value', kind='mergesort')
            sorted_frame['rank'] = np.arange(1, len(sorted_frame) + 1, dtype=int)
            if len(sorted_frame) > max_plot_points:
                sample_positions = np.linspace(0, len(sorted_frame) - 1, max_plot_points).round().astype(int)
                important_positions = np.flatnonzero(sorted_frame['is_outlier'].to_numpy())
                positions = np.unique(np.concatenate([sample_positions, important_positions]))
                sorted_frame = sorted_frame.iloc[positions]
            plots.append(output(
                str(node['id']), f'{node_label(node)} · {column}', 'stair_outlier',
                column=column,
                ranks=sorted_frame['rank'].astype(int).tolist(),
                original_values=sorted_frame['value'].astype(float).tolist(),
                corrected_values=[None if pd.isna(value) else float(value) for value in sorted_frame['corrected']],
                outlier_flags=sorted_frame['is_outlier'].astype(bool).tolist(),
                lower_boundary=lower.boundary, upper_boundary=upper.boundary,
                replacement=replacement, color=color,
            ))

        report_df = pd.DataFrame(reports)
        outliers_df = pd.DataFrame(outlier_rows)
        report = {'columns': selected, 'tail': tail, 'sensitivity': sensitivity, 'max_outlier_fraction': max_fraction, 'replacement': replacement, 'summary': reports}
        plot_output = output(str(node['id']), f'{node_label(node)} · Stair Plots', 'plot_group', plots=plots, count=len(plots), layout='vertical') if len(plots) > 1 else (plots[0] if plots else output(str(node['id']), node_label(node), 'json', value=report))
        outputs = [table_output(str(node['id']), f'{node_label(node)} · Summary', report_df, 500)]
        if not outliers_df.empty:
            outputs.append(table_output(str(node['id']), f'{node_label(node)} · Outlier Rows', outliers_df, 1000))
        outputs.append(plot_output)
        return dataframe_result(
            corrected,
            id_column=payload.id_column if payload and payload.id_column in corrected.columns else None,
            meta={**(payload.meta if payload else {}), 'sorted_gap_outlier': report},
            report=report,
            outputs_by_port={
                'dataframe': dataframe_result(corrected, id_column=payload.id_column if payload else None, meta={'sorted_gap_outlier': report}),
                'report': dataframe_result(report_df, id_column='column', meta={'sorted_gap_outlier': report}),
                'plot': plot_output,
            },
            output=outputs[0],
            outputs=outputs,
        )
