from __future__ import annotations

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, dataframe_result, ensure_df, node_label, table_output


class DataOverviewNode(BaseNode):
    id = 'IN-001'
    name = 'Data Description'
    category = 'Data Inspection'
    description = 'Returns the pandas describe() table for the connected dataframe.'

    inputs = [
        port('data', 'DataFrame', 'dataframe'),
    ]

    outputs = [
        port('dataframe', 'DataFrame', 'dataframe'),
        port('profile', 'Description JSON', 'json'),
    ]

    settings_schema = [
        setting('include', 'Describe Include', 'select', 'all', options=['numeric', 'all']),
        setting('max_output_rows', 'Max Output Rows', 'integer', 200),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))

        include = str(settings.get('include') or 'all')
        max_rows = int(settings.get('max_output_rows') or 200)

        if include == 'numeric':
            desc = df.describe().reset_index().rename(columns={'index': 'statistic'})
        else:
            desc = df.describe(include='all').reset_index().rename(columns={'index': 'statistic'})

        profile = {
            'rows': int(len(df)),
            'columns': int(len(df.columns)),
            'column_names': [str(c) for c in df.columns],
            'dtypes': {str(c): str(df[c].dtype) for c in df.columns},
            'describe': desc.to_dict(orient='records'),
        }

        return dataframe_result(
            df,
            id_column=payload.id_column if payload else None,
            meta=payload.meta if payload else {},
            profile_report=profile,
            json=profile,
            output=table_output(str(node['id']), f'{node_label(node)} · pandas describe()', desc, max_rows),
        )
