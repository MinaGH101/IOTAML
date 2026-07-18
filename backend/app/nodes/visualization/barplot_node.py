from __future__ import annotations

from typing import Any

import pandas as pd

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import ensure_df, first_upstream_df, node_label, output, parse_number_list, selected_columns


def _text_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value or '').replace(';', ',').split(',') if item.strip()]


def _series_colors(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    result: dict[str, str] = {}
    for key, color in value.items():
        text = str(color or '').strip()
        if text:
            result[str(key)] = text
    return result


class BarPlotNode(BaseNode):
    id = 'VZ-005'
    name = 'Bar Plot'
    category = 'Visualizations'
    description = 'Uses selected dataframe columns as X labels and selected rows, identified by the first dataframe column, as bar series.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('plot', 'Bar Plot', 'plot')]
    settings_schema = [
        setting('x_columns', 'X-axis Columns', 'columns', [], True, help='Each selected dataframe column becomes one X-axis label.'),
        setting('selected_rows', 'Y-axis Rows', 'row_values', [], True, supports_dynamic=False, help='Rows are identified by values in the first dataframe column. Each selected row becomes one bar series.'),
        setting('series_colors', 'Series Colors', 'series_colors', {}, supports_dynamic=False, help='Choose one color for each selected row series.'),
        setting('orientation', 'Orientation', 'select', 'vertical', options=['vertical', 'horizontal']),
        setting('guideline_values', 'Guideline Values', 'text', '', help='Optional comma-separated guideline values such as 10, 20.'),
        setting('guideline_labels', 'Guideline Labels', 'text', '', help='Optional comma-separated labels in the same order.'),
    ]
    cache_version = '3'

    def run(self, node, inputs, settings, context):
        df = ensure_df(first_upstream_df(inputs, 'data'), str(node['id']))
        if len(df.columns) < 2:
            raise ValueError('Bar Plot requires an index column and at least one value column.')

        row_index_column = str(df.columns[0])
        x_columns = selected_columns({'columns': settings.get('x_columns')}, df)
        x_columns = [column for column in x_columns if column != row_index_column]
        if not x_columns:
            raise ValueError('Select at least one value column for the X axis. The first dataframe column is reserved as the row index.')

        selected_rows = _text_list(settings.get('selected_rows'))
        if not selected_rows:
            raise ValueError('Select at least one row for the Y axis.')

        labels = df[row_index_column].astype(str).str.strip()
        if labels.eq('').any():
            raise ValueError('The first dataframe column contains empty row labels.')
        duplicate_labels = labels[labels.duplicated(keep=False)]
        if not duplicate_labels.empty:
            examples = ', '.join(duplicate_labels.drop_duplicates().head(5))
            raise ValueError(f'Values in the first dataframe column must be unique. Duplicates: {examples}')

        indexed = df.copy()
        indexed['__iota_row_label'] = labels
        indexed = indexed.set_index('__iota_row_label', drop=False)
        missing = [row for row in selected_rows if row not in indexed.index]
        if missing:
            raise ValueError(f'Selected rows were not found: {", ".join(missing[:10])}')

        colors = _series_colors(settings.get('series_colors'))
        series = []
        for row_label in selected_rows:
            row = indexed.loc[row_label]
            values: list[float | None] = []
            for column in x_columns:
                numeric = pd.to_numeric(pd.Series([row[column]]), errors='coerce').iloc[0]
                values.append(None if pd.isna(numeric) else float(numeric))
            series.append({'label': row_label, 'data': values, 'color': colors.get(row_label)})

        if not any(any(value is not None for value in item['data']) for item in series):
            raise ValueError('The selected row and column intersections contain no numeric values.')

        guideline_values = parse_number_list(settings.get('guideline_values'), [])
        guideline_labels = _text_list(settings.get('guideline_labels'))
        guidelines = [
            {'value': value, 'label': guideline_labels[index] if index < len(guideline_labels) else f'Guide {index + 1}'}
            for index, value in enumerate(guideline_values)
        ]
        result = output(
            str(node['id']), node_label(node), 'bar_plot',
            categories=x_columns,
            series=series,
            row_index_column=row_index_column,
            selected_rows=selected_rows,
            orientation=str(settings.get('orientation') or 'vertical'),
            guidelines=guidelines,
        )
        return {'plot': {'type': 'bar_plot'}, 'outputs_by_port': {'plot': result}, 'output': result}
