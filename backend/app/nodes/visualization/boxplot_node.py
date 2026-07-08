from __future__ import annotations

from typing import Any

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import coerce_numeric_series, ensure_df, first_upstream_df, node_label, numeric_df, output


def _columns_setting(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item)]
    if isinstance(value, str) and value.strip():
        return [item.strip() for item in value.split(',') if item.strip()]
    return []


class BoxPlotNode(BaseNode):
    id = 'VZ-004'
    name = 'Box Plot'
    category = 'Visualizations'
    description = 'Creates one or more box plot statistic panels for selected numeric columns.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('plot', 'Box Plot', 'plot')]
    settings_schema = [setting('columns', 'Columns', 'columns', [], help='Select one or more numeric columns.')]

    def run(self, node, inputs, settings, context):
        df = ensure_df(first_upstream_df(inputs, 'data'), str(node['id']))
        numeric_columns = list(numeric_df(df).columns)
        selected = _columns_setting(settings.get('columns'))
        if not selected:
            legacy_col = settings.get('column')
            selected = [str(legacy_col)] if legacy_col else ([numeric_columns[0]] if numeric_columns else [])
        selected = [col for col in selected if col in df.columns]
        if not selected:
            raise ValueError('Select at least one numeric column for box plot.')

        plots: list[dict[str, Any]] = []
        for col in selected:
            s = coerce_numeric_series(df, str(col)).dropna()
            if s.empty:
                continue
            plots.append(output(str(node['id']), f'{node_label(node)} · {col}', 'boxplot', column=str(col), min=s.min(), q1=s.quantile(.25), median=s.median(), q3=s.quantile(.75), max=s.max()))

        if not plots:
            raise ValueError('Selected columns have no numeric values for box plot.')
        if len(plots) == 1:
            return {'_df': df, 'plot': {'type': 'boxplot'}, 'output': plots[0]}
        return {'_df': df, 'plot': {'type': 'boxplot_group'}, 'output': output(str(node['id']), node_label(node), 'plot_group', plots=plots, count=len(plots), layout='vertical')}
