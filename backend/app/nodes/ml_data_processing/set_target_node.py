"""Workflow node implementation for set target node in the ml data processing family."""

from __future__ import annotations

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import calculation_columns, dataframe_payload, dataframe_result, ensure_df, metrics_output, node_label, table_output


class SetTargetNode(BaseNode):
    cache_version = '2'
    id = 'MP-003'
    name = 'Set Target Column'
    category = 'ML Data Processing'
    description = 'Stores the target column name for downstream model nodes.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'DataFrame', 'dataframe'), port('target', 'Target DataFrame', 'dataframe')]
    settings_schema = [setting('target_column', 'Target Column', 'column', '', required=True)]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))
        target = str(settings.get('target_column') or getattr(context, 'target_column', None) or '')
        if target not in calculation_columns(df):
            raise ValueError('Select a valid active target column. The workflow ID cannot be the target.')
        dataframe = dataframe_result(df, meta={**(payload.meta if payload else {}), 'target_column': target})
        target_df = df[[target]].copy()
        target_result = dataframe_result(target_df, reset_lineage=True)
        target_preview = table_output(str(node['id']), f'{node_label(node)} · Target', target_df, 100)
        return {
            **dataframe,
            'target_column': target,
            'target': target_result,
            'json': {'target_column': target},
            'outputs_by_port': {'dataframe': dataframe, 'target': target_result},
            'output': metrics_output(str(node['id']), node_label(node), {'target_column': target}),
            'outputs': [metrics_output(str(node['id']), node_label(node), {'target_column': target}), target_preview],
        }
