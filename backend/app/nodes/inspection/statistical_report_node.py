"""Workflow node implementation for statistical report node in the inspection family."""

from __future__ import annotations

from typing import Any

import pandas as pd

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import calculation_columns, coerce_numeric_series, dataframe_payload, dataframe_result, ensure_df, node_label, selected_columns, table_output


METRICS = ['count', 'missing', 'missing_percent', 'unique', 'mean', 'std', 'variance', 'min', 'q1', 'median', 'q3', 'max', 'skew', 'kurtosis', 'mode']


def _parse_list(value: Any, default: list[str]) -> list[str]:
    if isinstance(value, list):
        return [str(v) for v in value]
    if isinstance(value, str) and value.strip():
        return [v.strip() for v in value.split(',') if v.strip()]
    return default


def _metric_value(metric: str, series: pd.Series, numeric: pd.Series) -> Any:
    value: Any = None
    if metric == 'count': value = int(series.notna().sum())
    elif metric == 'missing': value = int(series.isna().sum())
    elif metric == 'missing_percent': value = round(float(series.isna().mean() * 100), 6)
    elif metric == 'unique': value = int(series.nunique(dropna=True))
    elif metric == 'mean': value = numeric.mean()
    elif metric == 'std': value = numeric.std()
    elif metric == 'variance': value = numeric.var()
    elif metric == 'min': value = numeric.min()
    elif metric == 'q1': value = numeric.quantile(0.25)
    elif metric == 'median': value = numeric.median()
    elif metric == 'q3': value = numeric.quantile(0.75)
    elif metric == 'max': value = numeric.max()
    elif metric == 'skew': value = numeric.skew()
    elif metric == 'kurtosis': value = numeric.kurtosis()
    elif metric == 'mode':
        modes = series.dropna().mode()
        value = None if modes.empty else modes.iloc[0]
    return None if pd.isna(value) else (round(float(value), 6) if isinstance(value, (int, float)) and metric not in {'count', 'missing', 'unique'} else value)


def _group_label(value: Any) -> str:
    try:
        if bool(pd.isna(value)):
            return 'Missing'
    except (TypeError, ValueError):
        pass
    return str(value)


class StatisticalReportNode(BaseNode):
    id = 'IN-007'
    name = 'Statistical Report'
    category = 'Data Inspection'
    description = 'Calculates selected statistical metrics for selected columns, optionally grouped by selected columns.'
    cache_version = '2'

    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('report', 'Statistical Report', 'dataframe')]

    settings_schema = [
        setting('columns', 'Columns', 'columns', []),
        setting('group_by', 'Group By', 'columns', [], help='Choose one column. Each unique value becomes a separate result column.'),
        setting('metrics', 'Metrics', 'multiselect', ['count', 'missing', 'mean', 'std', 'min', 'median', 'max'], options=METRICS),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))
        columns = selected_columns(settings, df) or calculation_columns(df)
        group_by = selected_columns({'columns': settings.get('group_by')}, df)[:1]
        columns = [column for column in columns if column not in group_by]
        metrics = _parse_list(settings.get('metrics'), ['count', 'missing', 'mean', 'std', 'min', 'median', 'max'])

        if group_by:
            grouped_frames: list[tuple[str, pd.DataFrame]] = []
            used_labels: dict[str, int] = {}
            for group_value, group_df in df.groupby(group_by[0], dropna=False, sort=False, observed=True):
                base_label = _group_label(group_value)
                if base_label in {'column', 'statistic'}:
                    base_label = f'{group_by[0]}={base_label}'
                used_labels[base_label] = used_labels.get(base_label, 0) + 1
                suffix = used_labels[base_label]
                label = base_label if suffix == 1 else f'{base_label} ({suffix})'
                grouped_frames.append((label, group_df))

            rows = []
            for col in columns:
                for metric in metrics:
                    row: dict[str, Any] = {'column': str(col), 'statistic': metric}
                    for label, group_df in grouped_frames:
                        row[label] = _metric_value(metric, group_df[col], coerce_numeric_series(group_df, col))
                    rows.append(row)
        else:
            rows = []
            for col in columns:
                series = df[col]
                numeric = coerce_numeric_series(df, col)
                row = {'column': str(col)}
                for metric in metrics:
                    row[metric] = _metric_value(metric, series, numeric)
                rows.append(row)

        report_df = pd.DataFrame(rows)
        return {
            'report': dataframe_result(report_df, id_column='column'),
            'output': table_output(str(node['id']), node_label(node), report_df, 500),
        }
