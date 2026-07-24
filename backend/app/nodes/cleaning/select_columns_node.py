from __future__ import annotations

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, dataframe_result, ensure_df, node_label, selected_columns, table_output


class SelectColumnsNode(BaseNode):
    id = 'CL-006'
    name = 'Select Rows / Columns'
    category = 'Data Cleaning'
    description = 'Selects or drops calculation columns and optionally filters rows while preserving the workflow ID.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'Selected DataFrame', 'dataframe')]
    settings_schema = [
        setting('mode', 'Column Mode', 'select', 'select', options=['select', 'drop']),
        setting('columns', 'Columns', 'columns', [], required=False, help='Calculation columns only. The ID column is carried automatically.'),
        setting('id_column', 'ID Column', 'column', None, required=False, supports_dynamic=False, help='Defaults to the inherited workflow ID. Original source columns remain available here.'),
        setting('row_query', 'Row Query', 'text', '', required=False, help='Optional pandas query, e.g. age > 30 and income < 100000'),
        setting('row_start', 'Row Start', 'integer', None, required=False),
        setting('row_end', 'Row End', 'integer', None, required=False),
    ]
    cache_version = '2'

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))
        source_id_column = payload.id_column if payload else None
        id_column = settings.get('id_column') or source_id_column
        id_column = str(id_column).strip() if id_column not in [None, ''] else None

        if id_column and id_column not in payload.id_options:
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

        if not df.index.is_unique or not payload.df.index.is_unique or not df.index.isin(payload.df.index).all():
            raise ValueError('Row selection changed row identity; use a lineage-resetting aggregation node instead.')
        row_mapping = dict(zip(payload.df.index, payload.row_keys, strict=True))
        row_keys = [int(row_mapping[index]) for index in df.index]

        current_active = list(payload.active_columns or [str(c) for c in df.columns if str(c) != source_id_column]) if payload else [str(c) for c in df.columns]
        current_active = [c for c in current_active if c in df.columns and c != id_column]
        cols = [c for c in selected_columns(settings, df) if c != id_column]
        mode = str(settings.get('mode') or 'select')

        if mode == 'drop':
            active_columns = [c for c in current_active if c not in cols]
        else:
            active_columns = [c for c in cols if c in current_active] if cols else current_active

        next_df = df.loc[:, [column for column in active_columns if column in df.columns]].copy()
        if id_column:
            id_values = payload.lineage.source_df.iloc[row_keys][id_column].to_numpy(copy=False)
            next_df.insert(0, id_column, id_values)
        preview = table_output(str(node['id']), node_label(node), next_df, 100)
        preview['id_column'] = id_column
        preview['active_columns'] = active_columns
        preview['source_columns'] = list(payload.source_columns or [])
        return dataframe_result(
            next_df,
            id_column=id_column,
            active_columns=active_columns,
            source_columns=list(payload.source_columns or []),
            lineage=payload.lineage,
            row_keys=row_keys,
            meta={**(payload.meta if payload else {}), 'selected_columns': active_columns},
            output=preview,
        )
