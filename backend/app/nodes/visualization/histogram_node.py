from __future__ import annotations

from typing import Any

import numpy as np
from app.nodes.base import BaseNode, port, setting
from app.nodes.io import coerce_numeric_series, ensure_df, first_upstream_df, node_label, numeric_df, output


def _columns_setting(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item)]
    if isinstance(value, str) and value.strip():
        return [item.strip() for item in value.split(',') if item.strip()]
    return []


class HistogramNode(BaseNode):
    id = 'VZ-002'
    name = 'Histogram'
    category = 'Visualizations'
    description = 'Creates one or more histogram plots for selected numeric columns.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('plot', 'Histogram Plot', 'plot')]
    settings_schema = [
        setting('columns', 'Columns', 'columns', [], help='Select one or more numeric columns.'),
        setting('bins', 'Bins', 'integer', 20),
    ]

    def run(self, node, inputs, settings, context):
        df = ensure_df(first_upstream_df(inputs, 'data'), str(node['id']))
        numeric_columns = list(numeric_df(df).columns)
        selected = _columns_setting(settings.get('columns'))
        if not selected:
            legacy_col = settings.get('column')
            selected = [str(legacy_col)] if legacy_col else ([numeric_columns[0]] if numeric_columns else [])
        selected = [col for col in selected if col in df.columns]
        if not selected:
            raise ValueError('Select at least one numeric column for histogram.')

        bins = int(settings.get('bins') or 20)
        plots: list[dict[str, Any]] = []
        for col in selected:
            values = coerce_numeric_series(df, str(col)).dropna()
            if values.empty:
                continue
            counts, edges = np.histogram(values, bins=bins)
            plots.append(output(str(node['id']), f'{node_label(node)} · {col}', 'histogram', column=str(col), counts=counts, edges=edges))

        if not plots:
            raise ValueError('Selected columns have no numeric values for histogram.')
        if len(plots) == 1:
            return {'_df': df, 'plot': {'type': 'histogram'}, 'output': plots[0]}
        return {'_df': df, 'plot': {'type': 'histogram_group'}, 'output': output(str(node['id']), node_label(node), 'plot_group', plots=plots, count=len(plots), layout='vertical')}
