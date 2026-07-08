from __future__ import annotations

import pandas as pd
from sklearn.model_selection import train_test_split

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_result, metrics_output, node_label, table_output
from app.nodes.ml_data_processing.ml_utils import feature_target_from_inputs, training_frame


class TrainTestSplitNode(BaseNode):
    id = 'MP-001'
    name = 'Train/Test Split'
    category = 'ML Data Processing'
    description = 'Splits selected features and target into X_train, X_test, y_train, and y_test.'

    inputs = [port('data', 'Features + Target', 'dataframe')]
    outputs = [port('split', 'Train/Test Data', 'json'), port('report', 'Split Report', 'json')]

    settings_schema = [
        setting('test_size', 'Test Size', 'number', 0.2),
        setting('random_state', 'Random State', 'integer', 42),
        setting('shuffle', 'Shuffle', 'boolean', True),
        setting('stratify', 'Stratify Classification Target', 'boolean', False),
    ]

    def run(self, node, inputs, settings, context):
        x, y, target, features, payload = feature_target_from_inputs(inputs, settings, context, str(node['id']))
        data = pd.concat([x, y.rename(target)], axis=1).dropna(subset=[target])
        x = data[features]
        y = data[target]

        test_size = float(settings.get('test_size') or 0.2)
        random_state = int(settings.get('random_state') or 42)
        shuffle = bool(settings.get('shuffle', True))
        stratify_enabled = bool(settings.get('stratify', False))
        stratify = y if stratify_enabled and y.nunique(dropna=True) > 1 else None

        x_train, x_test, y_train, y_test = train_test_split(
            x,
            y,
            test_size=test_size,
            random_state=random_state,
            shuffle=shuffle,
            stratify=stratify,
        )

        split_data = {
            'kind': 'train_test_split',
            'target_column': target,
            'feature_columns': features,
            'X_train': x_train,
            'X_test': x_test,
            'y_train': y_train,
            'y_test': y_test,
            'data_pairs': {
                'train': {'X': x_train, 'y': y_train, 'label': 'Train'},
                'test': {'X': x_test, 'y': y_test, 'label': 'Test'},
            },
        }

        report = {
            'target_column': target,
            'feature_count': len(features),
            'train_rows': int(len(x_train)),
            'test_rows': int(len(x_test)),
            'total_rows': int(len(x)),
            'test_size': test_size,
            'random_state': random_state,
            'shuffle': shuffle,
            'stratify': stratify_enabled,
        }

        report_df = pd.DataFrame([
            {'part': 'X_train', 'rows': len(x_train), 'columns': len(x_train.columns)},
            {'part': 'X_test', 'rows': len(x_test), 'columns': len(x_test.columns)},
            {'part': 'y_train', 'rows': len(y_train), 'columns': 1},
            {'part': 'y_test', 'rows': len(y_test), 'columns': 1},
        ])

        return dataframe_result(
            training_frame(x_train, y_train, target),
            id_column=None,
            meta={**(payload.meta if payload else {}), 'target_column': target, 'feature_columns': features, 'split': report},
            features_df=x,
            target_series=y,
            feature_columns=features,
            target_column=target,
            split_data=split_data,
            data_pairs=split_data['data_pairs'],
            report=report,
            json=report,
            output=table_output(str(node['id']), f'{node_label(node)} · Split Parts', report_df, 20),
            outputs=[metrics_output(str(node['id']), f'{node_label(node)} · Split Report', report), table_output(str(node['id']), f'{node_label(node)} · Split Parts', report_df, 20)],
        )
