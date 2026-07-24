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


class StatisticalReportNode(BaseNode):
    id = 'IN-007'
    name = 'Statistical Report'
    category = 'Data Inspection'
    description = 'Calculates selected statistical metrics for selected columns.'

    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('report', 'Statistical Report', 'dataframe')]

    settings_schema = [
        setting('columns', 'Columns', 'columns', []),
        setting('metrics', 'Metrics', 'multiselect', ['count', 'missing', 'mean', 'std', 'min', 'median', 'max'], options=METRICS),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))
        columns = selected_columns(settings, df) or calculation_columns(df)
        metrics = _parse_list(settings.get('metrics'), ['count', 'missing', 'mean', 'std', 'min', 'median', 'max'])

        rows: list[dict[str, Any]] = []
        for col in columns:
            s = df[col]
            numeric = coerce_numeric_series(df, col)
            row: dict[str, Any] = {'column': str(col)}
            for metric in metrics:
                value: Any = None
                if metric == 'count': value = int(s.notna().sum())
                elif metric == 'missing': value = int(s.isna().sum())
                elif metric == 'missing_percent': value = round(float(s.isna().mean() * 100), 6)
                elif metric == 'unique': value = int(s.nunique(dropna=True))
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
                    modes = s.dropna().mode()
                    value = None if modes.empty else modes.iloc[0]
                row[metric] = None if pd.isna(value) else (round(float(value), 6) if isinstance(value, (int, float)) and metric not in {'count', 'missing', 'unique'} else value)
            rows.append(row)

        report_df = pd.DataFrame(rows)
        return {
            'report': dataframe_result(report_df, id_column='column'),
            'output': table_output(str(node['id']), node_label(node), report_df, 500),
        }
