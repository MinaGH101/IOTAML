from __future__ import annotations

from typing import Any

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import coerce_numeric_series, ensure_df, first_upstream_df, node_label, numeric_df, output


def _list_setting(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _num(value: Any) -> float | None:
    if value in (None, ''):
        return None
    try:
        return float(value)
    except Exception:
        return None


class ScatterPlotNode(BaseNode):
    id = 'VZ-003'
    name = 'Scatter Plot'
    category = 'Visualizations'
    description = 'Creates one or more scatter plots from numeric column pairs.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('plot', 'Scatter Plot', 'plot')]
    settings_schema = [
        setting('scatter_blocks', 'Scatter Plot Blocks', 'scatter_blocks', [], help='Add multiple X/Y scatter plot blocks in one node.'),
        setting('x_column', 'X Column', 'column', ''),
        setting('y_column', 'Y Column', 'column', ''),
    ]

    def run(self, node, inputs, settings, context):
        df = ensure_df(first_upstream_df(inputs, 'data'), str(node['id']))
        nums = list(numeric_df(df).columns)
        blocks = _list_setting(settings.get('scatter_blocks'))

        if not blocks:
            blocks = [{
                'title': '',
                'x_column': settings.get('x_column') or (nums[0] if nums else None),
                'y_column': settings.get('y_column') or (nums[1] if len(nums) > 1 else None),
                'max_points': 1000,
            }]

        plots: list[dict[str, Any]] = []
        base_title = node_label(node)

        for index, block in enumerate(blocks):
            x = block.get('x_column') or block.get('x')
            y = block.get('y_column') or block.get('y')
            if not x or not y or x not in df.columns or y not in df.columns:
                continue

            try:
                max_points = max(10, min(10000, int(block.get('max_points') or 1000)))
            except Exception:
                max_points = 1000

            points_df = df[[x, y]].copy()
            points_df[x] = coerce_numeric_series(df, str(x))
            points_df[y] = coerce_numeric_series(df, str(y))
            points_df = points_df.dropna().head(max_points)
            plot_title = str(block.get('title') or f'{x} vs {y}')

            plots.append(output(
                str(node['id']),
                plot_title,
                'scatter',
                points=points_df.to_dict(orient='records'),
                x=str(x),
                y=str(y),
                color=block.get('color') or '',
                x_min=_num(block.get('x_min')),
                x_max=_num(block.get('x_max')),
                y_min=_num(block.get('y_min')),
                y_max=_num(block.get('y_max')),
                point_size=_num(block.get('point_size')) or 7,
                block_index=index,
            ))

        if not plots:
            raise ValueError('Add at least one valid scatter block with X and Y numeric columns.')

        if len(plots) == 1:
            return {'_df': df, 'plot': {'type': 'scatter'}, 'output': plots[0]}

        return {
            '_df': df,
            'plot': {'type': 'scatter_group'},
            'output': output(str(node['id']), base_title, 'plot_group', plots=plots, count=len(plots), layout='vertical')
        }
