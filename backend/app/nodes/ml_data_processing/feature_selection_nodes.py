from __future__ import annotations

from typing import Any

import pandas as pd
from sklearn.feature_selection import f_regression, mutual_info_classif, mutual_info_regression

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import output, table_output
from app.nodes.ml_data_processing.ml_utils import feature_target_from_inputs


def _is_classification(y: pd.Series) -> bool:
    clean = y.dropna()
    return clean.dtype == object or clean.dtype.name == 'category' or clean.nunique(dropna=True) <= 20


def _sort_rows(rows: list[dict[str, Any]], sort_order: str, value_key: str):
    reverse = sort_order != 'lowest'
    return sorted(rows, key=lambda r: float(r.get(value_key) or 0), reverse=reverse)


def _encode_x(x: pd.DataFrame) -> pd.DataFrame:
    encoded = pd.get_dummies(x.copy(), dummy_na=True)
    return encoded.apply(pd.to_numeric, errors='coerce').fillna(0)


class MutualInfoFeatureScoreNode(BaseNode):
    id = 'MP-021'
    name = 'Mutual Information Scores'
    category = 'ML Model Analysis'
    description = 'Scores features using mutual information and outputs a sortable bar plot plus score table.'

    inputs = [port('data', 'Features + Target', 'dataframe')]
    outputs = [port('scores', 'Feature Scores', 'json'), port('plot', 'Score Plot', 'plot')]

    settings_schema = [
        setting('target_column', 'Target Column', 'column', '', required=False),
        setting('columns', 'Feature Columns', 'columns', []),
        setting('task_type', 'Task Type', 'select', 'auto', options=['auto', 'regression', 'classification']),
        setting('n_neighbors', 'Neighbors', 'integer', 3),
        setting('random_state', 'Random State', 'integer', 42),
        setting('sort_order', 'Sort', 'select', 'highest', options=['highest', 'lowest']),
        setting('top_n', 'Top N', 'integer', 50),
    ]

    def run(self, node, inputs, settings, context):
        x, y, target, features, _payload = feature_target_from_inputs(inputs, settings, context, str(node['id']))
        x_encoded = _encode_x(x)
        task = str(settings.get('task_type') or 'auto')
        classification = _is_classification(y) if task == 'auto' else task == 'classification'
        if classification:
            scores = mutual_info_classif(x_encoded, y, n_neighbors=int(settings.get('n_neighbors') or 3), random_state=int(settings.get('random_state') or 42))
        else:
            scores = mutual_info_regression(x_encoded, pd.to_numeric(y, errors='coerce'), n_neighbors=int(settings.get('n_neighbors') or 3), random_state=int(settings.get('random_state') or 42))
        rows = [{'feature': str(feature), 'mutual_info': float(score)} for feature, score in zip(x_encoded.columns, scores)]
        rows = _sort_rows(rows, str(settings.get('sort_order') or 'highest'), 'mutual_info')
        rows = rows[:int(settings.get('top_n') or 50)]
        bar = output(str(node['id']), 'Mutual Information Scores', 'bar', rows=rows, xKey='feature', yKey='mutual_info')
        table = table_output(str(node['id']), 'Mutual Information Table', pd.DataFrame(rows), 500)
        report = {'target_column': target, 'feature_count': len(features), 'encoded_feature_count': len(x_encoded.columns), 'task_type': 'classification' if classification else 'regression', 'rows': rows}
        return {'scores': report, 'json': report, 'output': bar, 'outputs': [bar, table]}


class FRegressionFeatureScoreNode(BaseNode):
    id = 'MP-022'
    name = 'F-Regression Scores'
    category = 'ML Model Analysis'
    description = 'Scores regression features using sklearn f_regression and outputs a bar plot plus table.'

    inputs = [port('data', 'Features + Target', 'dataframe')]
    outputs = [port('scores', 'Feature Scores', 'json'), port('plot', 'Score Plot', 'plot')]

    settings_schema = [
        setting('target_column', 'Target Column', 'column', '', required=False),
        setting('columns', 'Feature Columns', 'columns', []),
        setting('center', 'Center', 'boolean', True),
        setting('force_finite', 'Force Finite', 'boolean', True),
        setting('sort_order', 'Sort', 'select', 'highest', options=['highest', 'lowest']),
        setting('top_n', 'Top N', 'integer', 50),
    ]

    def run(self, node, inputs, settings, context):
        x, y, target, features, _payload = feature_target_from_inputs(inputs, settings, context, str(node['id']))
        x_encoded = _encode_x(x)
        y_numeric = pd.to_numeric(y, errors='coerce')
        valid = y_numeric.notna()
        scores, pvalues = f_regression(x_encoded.loc[valid], y_numeric.loc[valid], center=bool(settings.get('center', True)), force_finite=bool(settings.get('force_finite', True)))
        rows = [{'feature': str(feature), 'f_score': float(score), 'p_value': float(pvalue)} for feature, score, pvalue in zip(x_encoded.columns, scores, pvalues)]
        rows = _sort_rows(rows, str(settings.get('sort_order') or 'highest'), 'f_score')
        rows = rows[:int(settings.get('top_n') or 50)]
        bar = output(str(node['id']), 'F-Regression Scores', 'bar', rows=rows, xKey='feature', yKey='f_score')
        table = table_output(str(node['id']), 'F-Regression Table', pd.DataFrame(rows), 500)
        report = {'target_column': target, 'feature_count': len(features), 'encoded_feature_count': len(x_encoded.columns), 'rows': rows}
        return {'scores': report, 'json': report, 'output': bar, 'outputs': [bar, table]}
