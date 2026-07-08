from __future__ import annotations

import pandas as pd
from app.nodes.base import BaseNode, port, setting
from app.nodes.io import ensure_df, first_upstream_df, node_label, selected_columns, table_output


class ConvertTypeNode(BaseNode):
    id = 'CL-004'
    name = 'Convert Column Type'
    category = 'Data Cleaning'
    description = 'Converts selected columns to numeric, text, boolean, or datetime.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'DataFrame', 'dataframe')]
    settings_schema = [
        setting('columns', 'Columns', 'columns', [], required=False),
        setting('target_type', 'Target Type', 'select', 'numeric', options=['numeric', 'text', 'boolean', 'datetime']),
    ]

    def run(self, node, inputs, settings, context):
        df = ensure_df(first_upstream_df(inputs, 'data'), str(node['id']))
        cols = selected_columns(settings, df)
        target = str(settings.get('target_type') or 'numeric')
        for c in cols:
            if target == 'numeric':
                df[c] = pd.to_numeric(df[c].astype(str).str.replace(',', '', regex=False).str.replace('<', '', regex=False).str.strip(), errors='coerce')
            elif target == 'datetime':
                df[c] = pd.to_datetime(df[c], errors='coerce')
            elif target == 'boolean':
                df[c] = df[c].astype(str).str.lower().isin(['1', 'true', 'yes', 'y'])
            else:
                df[c] = df[c].astype(str)
        return {'_df': df, 'output': table_output(str(node['id']), node_label(node), df, 100)}
