from __future__ import annotations

from typing import Any

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_result, ensure_df, first_upstream_df, node_label, table_output


class TransposeDataFrameNode(BaseNode):
    id = 'TR-014'
    name = 'Transpose DataFrame'
    category = 'Transformation'
    description = 'Uses one ID column as the new column names and transposes all remaining dataframe columns.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'Transposed DataFrame', 'dataframe')]
    settings_schema = [
        setting('id_column', 'ID Column', 'column', None, required=True, supports_dynamic=False, help='Values in this column become the transposed dataframe column names.'),
        setting('first_column_name', 'First Column Name', 'text', 'variable', required=True, supports_dynamic=False, help='Name of the first output column containing the original dataframe column names.'),
    ]
    cache_version = '2'

    def run(self, node: dict[str, Any], inputs: dict[str, Any], settings: dict[str, Any], context: Any) -> dict[str, Any]:
        df = ensure_df(first_upstream_df(inputs, 'data'), str(node['id']))
        # Read legacy keys as a migration fallback, but expose only the two settings above.
        id_column = str(settings.get('id_column') or settings.get('index_column') or '').strip()
        first_column_name = str(settings.get('first_column_name') or settings.get('output_label_column') or 'variable').strip()

        if not id_column or id_column not in df.columns:
            raise ValueError('Select a valid ID column for transpose.')
        if not first_column_name:
            raise ValueError('First Column Name is required.')

        labels = df[id_column].astype(str).str.strip()
        if labels.eq('').any():
            raise ValueError('The selected ID column contains empty values.')
        if labels.duplicated().any():
            examples = ', '.join(labels[labels.duplicated(keep=False)].drop_duplicates().head(5))
            raise ValueError(f'The selected ID column must contain unique values. Duplicates: {examples}')
        if first_column_name in set(labels):
            raise ValueError('First Column Name must be different from every value in the selected ID column.')

        values = df.drop(columns=[id_column]).copy()
        values.index = labels
        transposed = values.transpose().reset_index(names=first_column_name)

        visible = table_output(str(node['id']), node_label(node), transposed, 500)
        return dataframe_result(
            transposed,
            id_column=first_column_name,
            meta={'transpose': {'source_id_column': id_column, 'first_column_name': first_column_name}},
            outputs_by_port={'dataframe': dataframe_result(transposed, id_column=first_column_name)},
            output=visible,
        )
