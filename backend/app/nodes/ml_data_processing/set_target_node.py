from __future__ import annotations

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import calculation_columns, dataframe_payload, ensure_df, metrics_output, node_label


class SetTargetNode(BaseNode):
    id = 'MP-003'
    name = 'Set Target Column'
    category = 'ML Data Processing'
    description = 'Stores the target column name for downstream model nodes.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'DataFrame', 'dataframe'), port('target', 'Target Metadata', 'json')]
    settings_schema = [setting('target_column', 'Target Column', 'column', '', required=True)]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))
        target = str(settings.get('target_column') or context.target_column or '')
        if target not in calculation_columns(df):
            raise ValueError('Select a valid active target column. The workflow ID cannot be the target.')
        return {'_df': df, 'target_column': target, 'json': {'target_column': target}, 'output': metrics_output(str(node['id']), node_label(node), {'target_column': target})}
