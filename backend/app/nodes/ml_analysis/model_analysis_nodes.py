from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, mean_squared_error, precision_score, r2_score, recall_score

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, first_model_payload, json_output, metrics_output, node_label, output, safe_json, table_output
from app.nodes.ml_training.model_nodes import predict_with_payload
from app.nodes.types import ModelPayload


def _candidate_inputs(inputs: dict[str, Any]) -> list[Any]:
    return [value for key, value in inputs.items() if not str(key).startswith('_')]


def _pairs_from_item(item: Any) -> dict[str, dict[str, Any]]:
    if isinstance(item, ModelPayload):
        return dict((item.meta or {}).get('data_pairs') or {})
    if not isinstance(item, dict):
        return {}
    if item.get('data_pairs'):
        return dict(item.get('data_pairs') or {})
    if item.get('split_data'):
        return dict((item['split_data'] or {}).get('data_pairs') or {})
    if item.get('kfold_data'):
        return dict((item['kfold_data'] or {}).get('data_pairs') or {})
    if item.get('features_df') is not None and item.get('target_series') is not None:
        return {'external': {'X': item['features_df'], 'y': item['target_series'], 'label': 'External Data'}}
    payload = dataframe_payload({'x': item})
    if payload and payload.meta.get('target_column') and payload.meta.get('feature_columns'):
        target = str(payload.meta['target_column'])
        features = [c for c in payload.meta['feature_columns'] if c in payload.df.columns]
        if target in payload.df.columns and features:
            return {'external': {'X': payload.df[features], 'y': payload.df[target], 'label': 'External Data'}}
    return {}


def collect_data_pairs(inputs: dict[str, Any], model_payload: ModelPayload) -> dict[str, dict[str, Any]]:
    pairs = dict((model_payload.meta or {}).get('data_pairs') or {})
    for item in _candidate_inputs(inputs):
        pairs.update(_pairs_from_item(item))
    return pairs


def _selected_pair_keys(pairs: dict[str, dict[str, Any]], setting_value: Any) -> list[str]:
    if isinstance(setting_value, list):
        requested = [str(v) for v in setting_value]
    else:
        requested = [v.strip() for v in str(setting_value or 'auto').split(',') if v.strip()]
    if not requested or 'auto' in requested:
        if 'test' in pairs:
            return ['test']
        fold_tests = [k for k in pairs if k.startswith('fold_') and k.endswith('_test')]
        return fold_tests or (['all'] if 'all' in pairs else list(pairs.keys())[:1])
    keys: list[str] = []
    for item in requested:
        if item == 'fold_tests':
            keys.extend([k for k in pairs if k.startswith('fold_') and k.endswith('_test')])
        elif item in pairs:
            keys.append(item)
    return list(dict.fromkeys(keys))


def _is_classification(y: pd.Series, model_payload: ModelPayload) -> bool:
    task = str((model_payload.meta or {}).get('task_type') or '')
    if task in {'classification', 'regression'}:
        return task == 'classification'
    clean = y.dropna()
    return clean.dtype == object or clean.dtype.name == 'category' or clean.nunique(dropna=True) <= 20


def _safe_metric(metric: str, y_true: pd.Series, pred: np.ndarray, classification: bool, average: str):
    if classification:
        avg = 'binary' if average == 'auto' and y_true.nunique(dropna=True) == 2 else ('weighted' if average == 'auto' else average)
        if metric == 'accuracy':
            return float(accuracy_score(y_true, pred))
        if metric == 'precision':
            return float(precision_score(y_true, pred, average=avg, zero_division=0))
        if metric == 'recall':
            return float(recall_score(y_true, pred, average=avg, zero_division=0))
        if metric == 'f1':
            return float(f1_score(y_true, pred, average=avg, zero_division=0))
        return None

    y_num = pd.to_numeric(y_true, errors='coerce')
    p_num = pd.to_numeric(pd.Series(pred, index=y_true.index), errors='coerce')
    valid = y_num.notna() & p_num.notna()
    if not valid.any():
        return None
    if metric == 'r2':
        return float(r2_score(y_num[valid], p_num[valid]))
    if metric == 'mae':
        return float(mean_absolute_error(y_num[valid], p_num[valid]))
    if metric == 'rmse':
        return float(mean_squared_error(y_num[valid], p_num[valid]) ** 0.5)
    return None


class PredictionPreviewNode(BaseNode):
    id = 'MA-001'
    name = 'Prediction Plot'
    category = 'ML Model Analysis'
    description = 'Predicts a selected data pair and plots actual values against predictions.'

    inputs = [port('model', 'Model', 'model'), port('data', 'Extra Validation Data', 'any', required=False, multiple=True)]
    outputs = [port('plot', 'Prediction Plot', 'plot'), port('predictions', 'Predictions', 'json')]

    settings_schema = [
        setting('data_pairs', 'Data Pair', 'select', 'auto', options=['auto', 'test', 'train', 'all', 'fold_tests', 'external']),
        setting('max_points', 'Max Points', 'integer', 500),
        setting('x_min', 'X Min', 'number', None, required=False),
        setting('x_max', 'X Max', 'number', None, required=False),
        setting('y_min', 'Y Min', 'number', None, required=False),
        setting('y_max', 'Y Max', 'number', None, required=False),
    ]

    def run(self, node, inputs, settings, context):
        model_payload = first_model_payload(inputs)
        if model_payload is None:
            raise ValueError('Prediction Plot requires a trained model input.')

        pairs = collect_data_pairs(inputs, model_payload)
        keys = _selected_pair_keys(pairs, settings.get('data_pairs'))
        if not keys:
            raise ValueError('No validation data pair found. Connect Train/Test Split, K-Fold, or Feature/Target data.')

        key = keys[0]
        pair = pairs[key]
        fold = pair.get('fold') if str(key).startswith('fold_') else None
        pred = predict_with_payload(model_payload, pair['X'], int(fold) if fold else None)
        y = pair['y']
        rows = []
        for idx, actual, prediction in zip(pair['X'].index, y, pred):
            rows.append({
                'row_index': int(idx) if isinstance(idx, (int, np.integer)) else str(idx),
                'actual': safe_json(actual),
                'prediction': safe_json(prediction),
                'data_pair': key,
            })
        max_points = int(settings.get('max_points') or 500)
        points = rows[:max_points]
        scatter = output(
            str(node['id']),
            f'{node_label(node)} · {key}',
            'scatter',
            points=points,
            rows=points,
            x='actual',
            y='prediction',
            x_min=settings.get('x_min'),
            x_max=settings.get('x_max'),
            y_min=settings.get('y_min'),
            y_max=settings.get('y_max'),
            source_label=key,
        )
        table = table_output(str(node['id']), f'{node_label(node)} · Prediction Table', pd.DataFrame(rows), 200)
        return {'json': {'data_pair': key, 'predictions': rows}, 'output': scatter, 'outputs': [scatter, table]}


class MetricsSummaryNode(BaseNode):
    id = 'MA-003'
    name = 'Model Validation'
    category = 'ML Model Analysis'
    description = 'Validates a trained model on train/test/fold or externally connected data pairs.'

    inputs = [port('model', 'Model', 'model'), port('data', 'Extra Validation Data', 'any', required=False, multiple=True)]
    outputs = [port('metrics', 'Validation Metrics', 'metrics'), port('report', 'Validation Report', 'json')]

    settings_schema = [
        setting('data_pairs', 'Data Pairs', 'multiselect', ['auto'], options=['auto', 'train', 'test', 'all', 'fold_tests', 'external']),
        setting('metrics', 'Metrics', 'multiselect', ['r2', 'mae', 'rmse', 'accuracy', 'precision', 'recall', 'f1'], options=['r2', 'mae', 'rmse', 'accuracy', 'precision', 'recall', 'f1']),
        setting('average', 'Classification Average', 'select', 'auto', options=['auto', 'binary', 'macro', 'weighted', 'micro']),
    ]

    def run(self, node, inputs, settings, context):
        model_payload = first_model_payload(inputs)
        if model_payload is None:
            raise ValueError('Model Validation requires a trained model input.')

        pairs = collect_data_pairs(inputs, model_payload)
        keys = _selected_pair_keys(pairs, settings.get('data_pairs'))
        if not keys:
            raise ValueError('No validation data pair found. Connect Train/Test Split, K-Fold, or Feature/Target data.')

        metrics = settings.get('metrics') or []
        if not isinstance(metrics, list):
            metrics = [v.strip() for v in str(metrics).split(',') if v.strip()]
        average = str(settings.get('average') or 'auto')

        rows = []
        for key in keys:
            pair = pairs[key]
            fold = pair.get('fold') if str(key).startswith('fold_') else None
            pred = predict_with_payload(model_payload, pair['X'], int(fold) if fold else None)
            y = pair['y']
            classification = _is_classification(y, model_payload)
            row = {'data_pair': key, 'rows': int(len(y)), 'task_type': 'classification' if classification else 'regression'}
            for metric in metrics:
                value = _safe_metric(str(metric), y, pred, classification, average)
                if value is not None:
                    row[str(metric)] = round(value, 6)
            rows.append(row)

        report = {'rows': rows, 'selected_pairs': keys}
        return {'metrics': report, 'report': report, 'json': report, 'output': table_output(str(node['id']), node_label(node), pd.DataFrame(rows), 100)}


class FeatureImportanceNode(BaseNode):
    id = 'MA-006'
    name = 'Feature Importance'
    category = 'ML Model Analysis'
    description = 'Displays feature importances or linear coefficients when available.'
    inputs = [port('model', 'Model', 'model')]
    outputs = [port('importance', 'Feature Importance', 'json')]

    def run(self, node, inputs, settings, context):
        payload = first_model_payload(inputs)
        if payload is None:
            raise ValueError('Feature Importance requires a trained model input.')
        model = payload.model
        names = list((payload.meta or {}).get('encoded_columns') or getattr(model, 'feature_names_in_', []))
        values = getattr(model, 'feature_importances_', None)
        if values is None and hasattr(model, 'coef_'):
            values = np.ravel(getattr(model, 'coef_'))
        if values is None:
            return {'json': {'message': 'This model does not expose feature importance.'}, 'output': json_output(str(node['id']), node_label(node), {'message': 'This model does not expose feature importance.'})}
        rows = [{'feature': names[i] if i < len(names) else f'feature_{i}', 'importance': float(v)} for i, v in enumerate(np.ravel(values))]
        rows = sorted(rows, key=lambda item: abs(item['importance']), reverse=True)
        return {'json': {'features': rows}, 'output': output(str(node['id']), node_label(node), 'bar', rows=rows, xKey='feature', yKey='importance')}
