from __future__ import annotations

import pandas as pd
from sklearn.model_selection import KFold, StratifiedKFold

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_result, metrics_output, node_label, table_output
from app.nodes.ml_data_processing.ml_utils import feature_target_from_inputs, training_frame


class KFoldSplitNode(BaseNode):
    id = 'MP-004'
    name = 'K-Fold Split'
    category = 'ML Data Processing'
    description = 'Creates K-fold train/test data pairs for model training and validation.'

    inputs = [port('data', 'Features + Target', 'dataframe')]
    outputs = [port('folds', 'K-Fold Data', 'json'), port('report', 'Fold Report', 'json')]

    settings_schema = [
        setting('n_splits', 'Number of Folds', 'integer', 5),
        setting('shuffle', 'Shuffle', 'boolean', True),
        setting('random_state', 'Random State', 'integer', 42),
        setting('stratify', 'Stratify Classification Target', 'boolean', False),
    ]

    def run(self, node, inputs, settings, context):
        x, y, target, features, payload = feature_target_from_inputs(inputs, settings, context, str(node['id']))
        data = pd.concat([x, y.rename(target)], axis=1).dropna(subset=[target])
        x = data[features]
        y = data[target]

        n_splits = int(settings.get('n_splits') or 5)
        if n_splits < 2:
            raise ValueError('K-Fold requires at least 2 folds.')
        if n_splits > len(x):
            raise ValueError('Number of folds cannot be larger than the number of rows.')

        shuffle = bool(settings.get('shuffle', True))
        random_state = int(settings.get('random_state') or 42)
        stratify_enabled = bool(settings.get('stratify', False)) and y.nunique(dropna=True) > 1
        splitter = StratifiedKFold(n_splits=n_splits, shuffle=shuffle, random_state=random_state) if stratify_enabled else KFold(n_splits=n_splits, shuffle=shuffle, random_state=random_state)

        folds = []
        data_pairs = {}
        rows = []
        split_iter = splitter.split(x, y) if stratify_enabled else splitter.split(x)

        for fold_number, (train_idx, test_idx) in enumerate(split_iter, start=1):
            x_train = x.iloc[train_idx].copy()
            x_test = x.iloc[test_idx].copy()
            y_train = y.iloc[train_idx].copy()
            y_test = y.iloc[test_idx].copy()
            fold = {
                'fold': fold_number,
                'X_train': x_train,
                'X_test': x_test,
                'y_train': y_train,
                'y_test': y_test,
            }
            folds.append(fold)
            data_pairs[f'fold_{fold_number}_train'] = {'X': x_train, 'y': y_train, 'label': f'Fold {fold_number} Train', 'fold': fold_number, 'part': 'train'}
            data_pairs[f'fold_{fold_number}_test'] = {'X': x_test, 'y': y_test, 'label': f'Fold {fold_number} Test', 'fold': fold_number, 'part': 'test'}
            rows.append({'fold': fold_number, 'train_rows': len(x_train), 'test_rows': len(x_test), 'features': len(features)})

        report = {
            'target_column': target,
            'feature_count': len(features),
            'n_splits': n_splits,
            'shuffle': shuffle,
            'random_state': random_state,
            'stratify': stratify_enabled,
            'rows': int(len(x)),
        }

        return dataframe_result(
            training_frame(x, y, target),
            id_column=None,
            meta={**(payload.meta if payload else {}), 'target_column': target, 'feature_columns': features, 'kfold': report},
            features_df=x,
            target_series=y,
            feature_columns=features,
            target_column=target,
            kfold_data={'kind': 'k_fold', 'folds': folds, 'target_column': target, 'feature_columns': features, 'data_pairs': data_pairs},
            data_pairs=data_pairs,
            report=report,
            json=report,
            output=table_output(str(node['id']), f'{node_label(node)} · Folds', pd.DataFrame(rows), 100),
            outputs=[metrics_output(str(node['id']), f'{node_label(node)} · K-Fold Report', report), table_output(str(node['id']), f'{node_label(node)} · Folds', pd.DataFrame(rows), 100)],
        )
