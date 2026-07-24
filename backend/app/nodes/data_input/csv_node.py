from __future__ import annotations

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_result, materialize_dataset_path, node_label, read_dataset_path, table_output


class CsvInputNode(BaseNode):
    id = 'DI-002'
    name = 'Upload CSV/Excel'
    category = 'Data Input'
    description = 'Load an uploaded CSV, TSV, XLS, or XLSX dataset as a dataframe.'
    inputs = []
    outputs = [port('dataframe', 'DataFrame', 'dataframe'), port('schema', 'Schema', 'schema', required=False)]
    settings_schema = [
        setting('dataset_id', 'Dataset', 'dataset', None, required=False, supports_dynamic=False, help='Uploaded dataset to load. Falls back to workflow dataset.'),
        setting('id_column', 'ID Column', 'column', None, required=False, supports_dynamic=False, help='Optional unique row identifier column for joins, matching, filtering, and anomaly reports.'),
        setting('require_unique_id', 'Require Unique ID', 'boolean', True, required=False, supports_dynamic=False, help='When enabled, the selected ID column must have no missing or duplicate values.'),
        setting('sample_size', 'Preview Rows', 'integer', 100, required=False, supports_dynamic=False),
    ]

    def run(self, node, inputs, settings, context):
        selected_dataset_id = settings.get('dataset_id') or context.dataset_id
        if context.dataset_path and (not settings.get('dataset_id') or str(settings.get('dataset_id')) == str(context.dataset_id)):
            source_path = context.dataset_path
        else:
            source_path = materialize_dataset_path(selected_dataset_id)
        df = read_dataset_path(source_path)
        id_column = settings.get('id_column')
        id_column = str(id_column).strip() if id_column not in [None, ''] else None

        if id_column:
            if id_column not in df.columns:
                raise ValueError(f'ID column not found: {id_column}')
            if bool(settings.get('require_unique_id', True)):
                missing_count = int(df[id_column].isna().sum())
                duplicate_count = int(df[id_column].duplicated().sum())
                if missing_count:
                    raise ValueError(f'ID column "{id_column}" has {missing_count} missing values.')
                if duplicate_count:
                    raise ValueError(f'ID column "{id_column}" has {duplicate_count} duplicate values.')

        schema = [
            {
                'name': str(c),
                'dtype': str(df[c].dtype),
                'missing': int(df[c].isna().sum()),
                'unique': int(df[c].nunique(dropna=True)),
                'is_id': str(c) == id_column,
            }
            for c in df.columns
        ]
        preview = table_output(str(node['id']), node_label(node), df, int(settings.get('sample_size') or 100))
        preview['id_column'] = id_column
        return dataframe_result(
            df,
            id_column=id_column,
            meta={'source': 'dataset', 'schema': schema},
            source_ref=source_path,
            schema=schema,
            output=preview,
        )
