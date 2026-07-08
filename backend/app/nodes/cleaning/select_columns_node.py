from __future__ import annotations

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, dataframe_result, ensure_df, node_label, selected_columns, table_output


class SelectColumnsNode(BaseNode):
    id = 'CL-006'
    name = 'Select Rows / Columns'
    category = 'Data Cleaning'
    description = 'Selects or drops dataframe columns and optionally filters rows before passing the dataframe forward.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'Selected DataFrame', 'dataframe')]
    settings_schema = [
        setting('mode', 'Column Mode', 'select', 'select', options=['select', 'drop']),
        setting('columns', 'Columns', 'columns', [], required=False),
        setting('id_column', 'ID Column', 'column', None, required=False, supports_dynamic=False),
        setting('row_query', 'Row Query', 'text', '', required=False, help='Optional pandas query, e.g. age > 30 and income < 100000'),
        setting('row_start', 'Row Start', 'integer', None, required=False),
        setting('row_end', 'Row End', 'integer', None, required=False),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))
        source_id_column = payload.id_column if payload else None

        id_column = settings.get('id_column') or source_id_column
        id_column = str(id_column).strip() if id_column not in [None, ''] else None
        if id_column and id_column not in df.columns:
            raise ValueError(f'ID column not found: {id_column}')

        query = str(settings.get('row_query') or '').strip()
        if query:
            df = df.query(query)

        start = settings.get('row_start')
        end = settings.get('row_end')
        if start not in [None, ''] or end not in [None, '']:
            start_i = int(start) if start not in [None, ''] else None
            end_i = int(end) if end not in [None, ''] else None
            df = df.iloc[start_i:end_i]

        cols = selected_columns(settings, df)
        mode = str(settings.get('mode') or 'select')
        if mode == 'drop':
            next_df = df.drop(columns=cols, errors='ignore') if cols else df
        else:
            next_cols = [c for c in cols if c in df.columns] if cols else list(df.columns)
            if id_column and id_column in df.columns and id_column not in next_cols:
                next_cols = [id_column, *next_cols]
            next_df = df[next_cols]

        next_id_column = id_column if id_column and id_column in next_df.columns else None
        preview = table_output(str(node['id']), node_label(node), next_df, 100)
        preview['id_column'] = next_id_column
        return dataframe_result(
            next_df,
            id_column=next_id_column,
            meta={**(payload.meta if payload else {}), 'selected_columns': [str(c) for c in next_df.columns]},
            output=preview,
        )
