from __future__ import annotations

import math
from typing import Any

import numpy as np

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import coerce_numeric_series, ensure_df, first_upstream_df, node_label, numeric_df, output, selected_columns


def _normal_cdf(values: np.ndarray) -> np.ndarray:
    return np.array([0.5 * (1.0 + math.erf(float(value) / math.sqrt(2.0))) for value in values], dtype=float)


def _plotting_positions(size: int, method: str) -> np.ndarray:
    ranks = np.arange(1, size + 1, dtype=float)
    if method == 'weibull':
        return ranks / (size + 1.0)
    if method == 'hazen':
        return (ranks - 0.5) / size
    if method == 'blom':
        return (ranks - 0.375) / (size + 0.25)
    raise ValueError('Plotting position must be weibull, hazen, or blom.')


class PPPlotNode(BaseNode):
    id = 'VZ-006'
    name = 'P-P Plot'
    category = 'Visualizations'
    description = 'Creates normal probability-probability plots for one or more numeric columns with an x=y reference line.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('plot', 'P-P Plot', 'plot')]
    settings_schema = [
        setting('columns', 'Columns', 'columns', [], True),
        setting('plotting_position', 'Plotting Position', 'select', 'hazen', options=['hazen', 'weibull', 'blom']),
        setting('max_points', 'Max Points Per Plot', 'integer', 2000),
        setting('color', 'Color', 'color', '#31cde3', supports_dynamic=False),
    ]

    def run(self, node, inputs, settings, context):
        df = ensure_df(first_upstream_df(inputs, 'data'), str(node['id']))
        selected = selected_columns(settings, df)
        if not selected:
            selected = list(numeric_df(df).columns[:1])
        selected = [column for column in selected if column in df.columns]
        if not selected:
            raise ValueError('Select at least one numeric column for the P-P plot.')

        max_points = max(20, min(10000, int(settings.get('max_points') or 2000)))
        method = str(settings.get('plotting_position') or 'hazen')
        color = str(settings.get('color') or '#31cde3')
        plots: list[dict[str, Any]] = []
        for column in selected:
            values = np.sort(coerce_numeric_series(df, column).dropna().to_numpy(dtype=float))
            if values.size < 3:
                continue
            if values.size > max_points:
                indexes = np.linspace(0, values.size - 1, max_points).round().astype(int)
                values = values[indexes]
            standard_deviation = float(np.std(values, ddof=1))
            if not np.isfinite(standard_deviation) or standard_deviation == 0:
                continue
            z_values = (values - float(np.mean(values))) / standard_deviation
            theoretical = _normal_cdf(z_values)
            observed = _plotting_positions(len(values), method)
            points = [{'theoretical_probability': float(x), 'observed_probability': float(y)} for x, y in zip(theoretical, observed, strict=True)]
            plots.append(output(
                str(node['id']), f'{node_label(node)} · {column}', 'pp_plot',
                column=column, points=points, x='theoretical_probability', y='observed_probability',
                plotting_position=method, distribution='normal', color=color,
                x_min=0.0, x_max=1.0, y_min=0.0, y_max=1.0,
            ))
        if not plots:
            raise ValueError('Selected columns need at least three varying numeric values for a P-P plot.')
        if len(plots) == 1:
            return {'_df': df, 'plot': {'type': 'pp_plot'}, 'output': plots[0]}
        return {'_df': df, 'plot': {'type': 'pp_plot_group'}, 'output': output(str(node['id']), node_label(node), 'plot_group', plots=plots, count=len(plots), layout='vertical')}
