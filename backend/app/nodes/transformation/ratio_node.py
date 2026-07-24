from __future__ import annotations

import numpy as np
from app.nodes.base import BaseNode, port, setting
from app.nodes.io import calculation_columns, coerce_numeric_series, ensure_df, first_upstream_df, node_label, table_output


class RatioCalculatorNode(BaseNode):
    id = 'TR-013'
    name = 'Ratio Calculator'
    category = 'Transformation'
    description = 'Creates a new numeric column from numerator divided by denominator.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'DataFrame', 'dataframe')]
    settings_schema = [
        setting('numerator_column', 'Numerator Column', 'column', '', required=True),
        setting('denominator_column', 'Denominator Column', 'column', '', required=True),
        setting('output_column', 'Output Column', 'text', ''),
    ]

    def run(self, node, inputs, settings, context):
        df = ensure_df(first_upstream_df(inputs, 'data'), str(node['id']))
        numerator = str(settings.get('numerator_column') or '')
        denominator = str(settings.get('denominator_column') or '')
        allowed = set(calculation_columns(df))
        if numerator not in allowed or denominator not in allowed:
            raise ValueError('Select numerator and denominator from active calculation columns. The workflow ID is not allowed.')
        out = str(settings.get('output_column') or f'{numerator}_to_{denominator}')
        df[out] = coerce_numeric_series(df, numerator) / coerce_numeric_series(df, denominator).replace(0, np.nan)
        return {'_df': df, 'output': table_output(str(node['id']), node_label(node), df, 100)}
