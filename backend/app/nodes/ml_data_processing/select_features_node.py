from __future__ import annotations

import pandas as pd

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, dataframe_result, ensure_df, node_label, selected_columns, table_output


class SelectFeaturesNode(BaseNode):
    id = 'MP-002'
    name = 'Select Features & Target'
    category = 'ML Data Processing'
    description = 'Selects one target column and multiple feature columns for model training.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [
        port('dataframe', 'Training DataFrame', 'dataframe'),
        port('features', 'Feature DataFrame', 'dataframe'),
        port('target', 'Target Series', 'series'),
    ]
    settings_schema = [
        setting('target_column', 'Target Column', 'column', '', required=True),
        setting('columns', 'Feature Columns', 'columns', []),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))
        id_column = payload.id_column if payload else None

        target = str(settings.get('target_column') or '').strip()
        if not target or target not in df.columns:
            raise ValueError('Select a valid target column.')

        features = [c for c in selected_columns(settings, df) if c != target]
        if not features:
            features = [c for c in df.columns if c != target and c != id_column]

        feature_df = df[features].copy()
        target_series = df[target].copy()
        training_df = pd.concat([feature_df, target_series.rename(target)], axis=1)

        feature_preview = table_output(str(node['id']), f'{node_label(node)} · Features', feature_df, 100)
        target_preview = table_output(str(node['id']), f'{node_label(node)} · Target', target_series.to_frame(name=target), 100)

        return dataframe_result(
            training_df,
            id_column=None,
            meta={
                **(payload.meta if payload else {}),
                'feature_columns': [str(c) for c in features],
                'target_column': target,
            },
            features_df=feature_df,
            target_series=target_series,
            feature_columns=[str(c) for c in features],
            target_column=target,
            columns=[str(c) for c in features],
            target={'name': target, 'values': target_series.tolist()},
            data_pairs={'all': {'X': feature_df, 'y': target_series, 'label': 'All Data'}},
            output=feature_preview,
            outputs=[feature_preview, target_preview],
        )
