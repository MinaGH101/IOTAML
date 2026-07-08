from __future__ import annotations

from app.nodes.base import BaseNode, port
from app.nodes.io import first_json_payload, first_upstream_df, json_output, node_label, table_output


class PassThroughNode(BaseNode):
    id = 'UT-002'
    name = 'Pass Through'
    category = 'Utilities / Advanced'
    description = 'Passes dataframe or JSON input through unchanged.'
    inputs = [port('input', 'Input', 'any')]
    outputs = [port('output', 'Output', 'any')]

    def run(self, node, inputs, settings, context):
        df = first_upstream_df(inputs)
        if df is not None:
            return {'_df': df, 'output': table_output(str(node['id']), node_label(node), df, 100)}
        value = first_json_payload(inputs)
        return {'json': value, 'output': json_output(str(node['id']), node_label(node), value)}
