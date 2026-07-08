from __future__ import annotations

import pandas as pd
from app.nodes.base import BaseNode, port, setting
from app.nodes.io import all_upstream_dfs, node_label, table_output


class MergeDataFramesNode(BaseNode):
    id = 'UT-003'
    name = 'Merge DataFrames'
    category = 'Utilities / Advanced'
    description = 'Concatenates or joins two incoming dataframes.'
    inputs = [port('left', 'Left DataFrame', 'dataframe'), port('right', 'Right DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'Merged DataFrame', 'dataframe')]
    settings_schema = [setting('mode', 'Mode', 'select', 'concat_rows', options=['concat_rows', 'concat_columns']), setting('join_key', 'Join Key', 'column', '')]

    def run(self, node, inputs, settings, context):
        dfs = all_upstream_dfs(inputs)
        if len(dfs) < 2:
            raise ValueError('Merge DataFrames requires at least two dataframe inputs.')
        mode = str(settings.get('mode') or 'concat_rows')
        key = settings.get('join_key')
        if key and all(str(key) in df.columns for df in dfs[:2]):
            out = dfs[0].merge(dfs[1], on=str(key), how='left')
        elif mode == 'concat_columns':
            out = pd.concat([df.reset_index(drop=True) for df in dfs], axis=1)
        else:
            out = pd.concat(dfs, axis=0, ignore_index=True)
        return {'_df': out, 'output': table_output(str(node['id']), node_label(node), out, 100)}
