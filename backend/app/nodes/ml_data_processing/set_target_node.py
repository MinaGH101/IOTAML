from __future__ import annotations

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import ensure_df, first_upstream_df, metrics_output, node_label


class SetTargetNode(BaseNode):
    id = 'MP-003'
    name = 'Set Target Column'
    category = 'ML Data Processing'
    description = 'Stores the target column name for downstream model nodes.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'DataFrame', 'dataframe'), port('target', 'Target Metadata', 'json')]
    settings_schema = [setting('target_column', 'Target Column', 'column', '', required=True)]

    def run(self, node, inputs, settings, context):
        df = ensure_df(first_upstream_df(inputs, 'data'), str(node['id']))
        target = str(settings.get('target_column') or context.target_column or '')
        if target not in df.columns:
            raise ValueError('Select a valid target column.')
        return {'_df': df, 'target_column': target, 'json': {'target_column': target}, 'output': metrics_output(str(node['id']), node_label(node), {'target_column': target})}
