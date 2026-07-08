from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis, QuadraticDiscriminantAnalysis
from sklearn.ensemble import (
    ExtraTreesClassifier,
    ExtraTreesRegressor,
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import ElasticNet, Lasso, LinearRegression, LogisticRegression, Ridge
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.svm import LinearSVC, SVC
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import metrics_output, node_label
from app.nodes.ml_data_processing.ml_utils import feature_target_from_inputs
from app.nodes.types import ModelPayload


def _candidate_inputs(inputs: dict[str, Any]) -> list[Any]:
    return [value for key, value in inputs.items() if not str(key).startswith('_')]


def _clean_x(x: pd.DataFrame) -> pd.DataFrame:
    return x.copy().replace([np.inf, -np.inf], np.nan)


def _encode_fit(x: pd.DataFrame):
    raw = _clean_x(x)
    encoded = pd.get_dummies(raw, dummy_na=True)
    encoded = encoded.apply(pd.to_numeric, errors='coerce').fillna(0)
    return encoded, [str(c) for c in encoded.columns]


def encode_predict(x: pd.DataFrame, encoded_columns: list[str]) -> pd.DataFrame:
    raw = _clean_x(x)
    encoded = pd.get_dummies(raw, dummy_na=True)
    encoded = encoded.apply(pd.to_numeric, errors='coerce').fillna(0)
    return encoded.reindex(columns=encoded_columns, fill_value=0)


def _coerce_y_for_regression(y: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(y, errors='coerce')
    if numeric.dropna().empty:
        raise ValueError('Regression model requires a numeric target column.')
    return numeric


def _extract_training_source(inputs: dict[str, Any], settings: dict[str, Any], context: Any, node_id: str):
    train_mode = str(settings.get('train_mode') or 'auto')

    for item in _candidate_inputs(inputs):
        if isinstance(item, dict) and item.get('split_data'):
            split = item['split_data']
            if train_mode in {'auto', 'train_test_split'}:
                return {
                    'mode': 'train_test_split',
                    'target_column': split['target_column'],
                    'feature_columns': split['feature_columns'],
                    'X_train': split['X_train'],
                    'y_train': split['y_train'],
                    'data_pairs': split.get('data_pairs') or {},
                }
        if isinstance(item, dict) and item.get('kfold_data'):
            kfold = item['kfold_data']
            if train_mode in {'auto', 'k_fold'}:
                return {
                    'mode': 'k_fold',
                    'target_column': kfold['target_column'],
                    'feature_columns': kfold['feature_columns'],
                    'folds': kfold['folds'],
                    'data_pairs': kfold.get('data_pairs') or {},
                }
        if isinstance(item, dict) and item.get('features_df') is not None and item.get('target_series') is not None:
            if train_mode in {'auto', 'full_data'}:
                return {
                    'mode': 'full_data',
                    'target_column': item.get('target_column') or getattr(item.get('target_series'), 'name', None),
                    'feature_columns': item.get('feature_columns') or list(item['features_df'].columns),
                    'X_train': item['features_df'],
                    'y_train': item['target_series'],
                    'data_pairs': item.get('data_pairs') or {'all': {'X': item['features_df'], 'y': item['target_series'], 'label': 'All Data'}},
                }

    x, y, target, features, _payload = feature_target_from_inputs(inputs, settings, context, node_id)
    return {
        'mode': 'full_data',
        'target_column': target,
        'feature_columns': features,
        'X_train': x,
        'y_train': y,
        'data_pairs': {'all': {'X': x, 'y': y, 'label': 'All Data'}},
    }


def _fit_one(model: Any, x_train: pd.DataFrame, y_train: pd.Series, task_type: str):
    y = _coerce_y_for_regression(y_train) if task_type == 'regression' else y_train
    data = pd.concat([x_train, y.rename('__target__')], axis=1).dropna(subset=['__target__'])
    x_train = data.drop(columns=['__target__'])
    y = data['__target__']
    x_encoded, encoded_columns = _encode_fit(x_train)
    model.fit(x_encoded, y)
    return model, encoded_columns, len(x_encoded)


def predict_with_payload(payload: ModelPayload, x: pd.DataFrame, fold: int | None = None):
    meta = payload.meta or {}
    model = payload.model
    if fold is not None and isinstance(meta.get('fold_models'), list):
        models = meta['fold_models']
        if 1 <= fold <= len(models):
            model = models[fold - 1]
    encoded_columns = meta.get('encoded_columns') or []
    if fold is not None and isinstance(meta.get('fold_encoded_columns'), list):
        encoded_sets = meta['fold_encoded_columns']
        if 1 <= fold <= len(encoded_sets):
            encoded_columns = encoded_sets[fold - 1]
    x_encoded = encode_predict(x, encoded_columns)
    return model.predict(x_encoded)


COMMON_SETTINGS = [
    setting('train_mode', 'Train Mode', 'select', 'auto', options=['auto', 'full_data', 'train_test_split', 'k_fold'], required=False),
    setting('target_column', 'Target Column', 'column', '', required=False),
]


class _BaseSklearnModelNode(BaseNode):
    inputs = [port('training', 'Training Data / Split / Folds', 'any')]
    outputs = [port('model', 'Model', 'model'), port('metrics', 'Training Report', 'metrics')]
    settings_schema = COMMON_SETTINGS
    task_type = 'regression'

    def build_model(self, settings: dict[str, Any]):
        raise NotImplementedError

    def run(self, node, inputs, settings, context):
        source = _extract_training_source(inputs, settings, context, str(node['id']))
        mode = source['mode']
        target = str(source['target_column'])
        features = [str(c) for c in source['feature_columns']]

        if mode == 'k_fold':
            fold_models = []
            encoded_columns: list[str] | None = None
            fold_encoded_columns: list[list[str]] = []
            fold_rows = []
            for fold in source['folds']:
                model = self.build_model(settings)
                fitted, encoded_for_fold, train_rows = _fit_one(model, fold['X_train'], fold['y_train'], self.task_type)
                fold_models.append(fitted)
                fold_encoded_columns.append(encoded_for_fold)
                encoded_columns = encoded_columns or encoded_for_fold
                fold_rows.append({'fold': fold['fold'], 'train_rows': train_rows, 'test_rows': len(fold['X_test'])})

            primary_model = fold_models[-1]
            metrics = {
                'model': self.name,
                'model_task': self.task_type,
                'train_mode': 'k_fold',
                'folds_trained': len(fold_models),
                'target_column': target,
                'feature_count': len(features),
            }
            payload = ModelPayload(
                model=primary_model,
                features=features,
                target=target,
                metrics=metrics,
                meta={
                    'train_mode': 'k_fold',
                    'task_type': self.task_type,
                    'target_column': target,
                    'feature_columns': features,
                    'feature_count': len(features),
                    'encoded_columns': encoded_columns or [],
                    'fold_models': fold_models,
                    'fold_encoded_columns': fold_encoded_columns,
                    'data_pairs': source.get('data_pairs') or {},
                    'fold_report': fold_rows,
                },
            )
            return {'model': payload, 'metrics': metrics, 'output': metrics_output(str(node['id']), node_label(node), metrics)}

        model = self.build_model(settings)
        fitted, encoded_columns, train_rows = _fit_one(model, source['X_train'], source['y_train'], self.task_type)
        metrics = {
            'model': self.name,
            'model_task': self.task_type,
            'train_mode': mode,
            'target_column': target,
            'feature_count': len(features),
            'train_rows': train_rows,
        }
        payload = ModelPayload(
            model=fitted,
            features=features,
            target=target,
            metrics=metrics,
            meta={
                'train_mode': mode,
                'task_type': self.task_type,
                'target_column': target,
                'feature_columns': features,
                'feature_count': len(features),
                'encoded_columns': encoded_columns,
                'data_pairs': source.get('data_pairs') or {},
            },
        )
        return {'model': payload, 'metrics': metrics, 'output': metrics_output(str(node['id']), node_label(node), metrics)}


class _RegressionModelNode(_BaseSklearnModelNode):
    category = 'ML Regression Models'
    task_type = 'regression'


class _ClassificationModelNode(_BaseSklearnModelNode):
    category = 'ML Classification Models'
    task_type = 'classification'


class LinearRegressionNode(_RegressionModelNode):
    id = 'MR-001'
    name = 'Linear Regression'
    description = 'Trains a linear regression model.'

    def build_model(self, settings):
        return LinearRegression()


class RidgeRegressionNode(_RegressionModelNode):
    id = 'MR-002'
    name = 'Ridge Regression'
    description = 'Trains ridge regression with L2 regularization.'
    settings_schema = COMMON_SETTINGS + [setting('alpha', 'Alpha', 'number', 1.0)]

    def build_model(self, settings):
        return Ridge(alpha=float(settings.get('alpha') or 1.0))


class LassoRegressionNode(_RegressionModelNode):
    id = 'MR-003'
    name = 'Lasso Regression'
    description = 'Trains lasso regression with L1 regularization.'
    settings_schema = COMMON_SETTINGS + [setting('alpha', 'Alpha', 'number', 1.0), setting('max_iter', 'Max Iterations', 'integer', 5000)]

    def build_model(self, settings):
        return Lasso(alpha=float(settings.get('alpha') or 1.0), max_iter=int(settings.get('max_iter') or 5000))


class ElasticNetRegressionNode(_RegressionModelNode):
    id = 'MR-004'
    name = 'ElasticNet Regression'
    description = 'Trains elastic-net regression.'
    settings_schema = COMMON_SETTINGS + [setting('alpha', 'Alpha', 'number', 1.0), setting('l1_ratio', 'L1 Ratio', 'number', 0.5), setting('max_iter', 'Max Iterations', 'integer', 5000)]

    def build_model(self, settings):
        return ElasticNet(alpha=float(settings.get('alpha') or 1.0), l1_ratio=float(settings.get('l1_ratio') or 0.5), max_iter=int(settings.get('max_iter') or 5000))


class DecisionTreeRegressorNode(_RegressionModelNode):
    id = 'MR-005'
    name = 'Decision Tree Regressor'
    description = 'Trains a decision-tree regressor.'
    settings_schema = COMMON_SETTINGS + [setting('max_depth', 'Max Depth', 'integer', None, required=False), setting('random_state', 'Random State', 'integer', 42)]

    def build_model(self, settings):
        max_depth = settings.get('max_depth')
        return DecisionTreeRegressor(max_depth=int(max_depth) if max_depth not in [None, ''] else None, random_state=int(settings.get('random_state') or 42))


class RandomForestRegressorNode(_RegressionModelNode):
    id = 'MR-006'
    name = 'Random Forest Regressor'
    description = 'Trains a random-forest regressor.'
    settings_schema = COMMON_SETTINGS + [setting('n_estimators', 'Trees', 'integer', 100), setting('max_depth', 'Max Depth', 'integer', None, required=False), setting('random_state', 'Random State', 'integer', 42)]

    def build_model(self, settings):
        max_depth = settings.get('max_depth')
        return RandomForestRegressor(n_estimators=int(settings.get('n_estimators') or 100), max_depth=int(max_depth) if max_depth not in [None, ''] else None, random_state=int(settings.get('random_state') or 42), n_jobs=-1)


class ExtraTreesRegressorNode(_RegressionModelNode):
    id = 'MR-007'
    name = 'Extra Trees Regressor'
    description = 'Trains an extra-trees regressor.'
    settings_schema = COMMON_SETTINGS + [setting('n_estimators', 'Trees', 'integer', 100), setting('random_state', 'Random State', 'integer', 42)]

    def build_model(self, settings):
        return ExtraTreesRegressor(n_estimators=int(settings.get('n_estimators') or 100), random_state=int(settings.get('random_state') or 42), n_jobs=-1)


class GradientBoostingRegressorNode(_RegressionModelNode):
    id = 'MR-008'
    name = 'Gradient Boosting Regressor'
    description = 'Trains a gradient-boosting regressor.'
    settings_schema = COMMON_SETTINGS + [setting('n_estimators', 'Estimators', 'integer', 100), setting('learning_rate', 'Learning Rate', 'number', 0.1), setting('random_state', 'Random State', 'integer', 42)]

    def build_model(self, settings):
        return GradientBoostingRegressor(n_estimators=int(settings.get('n_estimators') or 100), learning_rate=float(settings.get('learning_rate') or 0.1), random_state=int(settings.get('random_state') or 42))


class HistGradientBoostingRegressorNode(_RegressionModelNode):
    id = 'MR-009'
    name = 'Hist Gradient Boosting Regressor'
    description = 'Trains a histogram gradient-boosting regressor.'
    settings_schema = COMMON_SETTINGS + [setting('max_iter', 'Max Iterations', 'integer', 100), setting('learning_rate', 'Learning Rate', 'number', 0.1), setting('random_state', 'Random State', 'integer', 42)]

    def build_model(self, settings):
        return HistGradientBoostingRegressor(max_iter=int(settings.get('max_iter') or 100), learning_rate=float(settings.get('learning_rate') or 0.1), random_state=int(settings.get('random_state') or 42))


class KNNRegressorNode(_RegressionModelNode):
    id = 'MR-010'
    name = 'KNN Regressor'
    description = 'Trains a k-nearest-neighbors regressor.'
    settings_schema = COMMON_SETTINGS + [setting('n_neighbors', 'Neighbors', 'integer', 5), setting('weights', 'Weights', 'select', 'uniform', options=['uniform', 'distance'])]

    def build_model(self, settings):
        return KNeighborsRegressor(n_neighbors=int(settings.get('n_neighbors') or 5), weights=str(settings.get('weights') or 'uniform'))


class LogisticRegressionNode(_ClassificationModelNode):
    id = 'MC-001'
    name = 'Logistic Regression Classifier'
    description = 'Trains a logistic-regression classifier.'
    settings_schema = COMMON_SETTINGS + [setting('C', 'C', 'number', 1.0), setting('max_iter', 'Max Iterations', 'integer', 1000)]

    def build_model(self, settings):
        return LogisticRegression(C=float(settings.get('C') or 1.0), max_iter=int(settings.get('max_iter') or 1000))


class DecisionTreeClassifierNode(_ClassificationModelNode):
    id = 'MC-002'
    name = 'Decision Tree Classifier'
    description = 'Trains a decision-tree classifier.'
    settings_schema = COMMON_SETTINGS + [setting('max_depth', 'Max Depth', 'integer', None, required=False), setting('random_state', 'Random State', 'integer', 42)]

    def build_model(self, settings):
        max_depth = settings.get('max_depth')
        return DecisionTreeClassifier(max_depth=int(max_depth) if max_depth not in [None, ''] else None, random_state=int(settings.get('random_state') or 42))


class RandomForestClassifierNode(_ClassificationModelNode):
    id = 'MC-003'
    name = 'Random Forest Classifier'
    description = 'Trains a random-forest classifier.'
    settings_schema = COMMON_SETTINGS + [setting('n_estimators', 'Trees', 'integer', 100), setting('max_depth', 'Max Depth', 'integer', None, required=False), setting('random_state', 'Random State', 'integer', 42)]

    def build_model(self, settings):
        max_depth = settings.get('max_depth')
        return RandomForestClassifier(n_estimators=int(settings.get('n_estimators') or 100), max_depth=int(max_depth) if max_depth not in [None, ''] else None, random_state=int(settings.get('random_state') or 42), n_jobs=-1)


class ExtraTreesClassifierNode(_ClassificationModelNode):
    id = 'MC-004'
    name = 'Extra Trees Classifier'
    description = 'Trains an extra-trees classifier.'
    settings_schema = COMMON_SETTINGS + [setting('n_estimators', 'Trees', 'integer', 100), setting('random_state', 'Random State', 'integer', 42)]

    def build_model(self, settings):
        return ExtraTreesClassifier(n_estimators=int(settings.get('n_estimators') or 100), random_state=int(settings.get('random_state') or 42), n_jobs=-1)


class GradientBoostingClassifierNode(_ClassificationModelNode):
    id = 'MC-005'
    name = 'Gradient Boosting Classifier'
    description = 'Trains a gradient-boosting classifier.'
    settings_schema = COMMON_SETTINGS + [setting('n_estimators', 'Estimators', 'integer', 100), setting('learning_rate', 'Learning Rate', 'number', 0.1), setting('random_state', 'Random State', 'integer', 42)]

    def build_model(self, settings):
        return GradientBoostingClassifier(n_estimators=int(settings.get('n_estimators') or 100), learning_rate=float(settings.get('learning_rate') or 0.1), random_state=int(settings.get('random_state') or 42))


class HistGradientBoostingClassifierNode(_ClassificationModelNode):
    id = 'MC-006'
    name = 'Hist Gradient Boosting Classifier'
    description = 'Trains a histogram gradient-boosting classifier.'
    settings_schema = COMMON_SETTINGS + [setting('max_iter', 'Max Iterations', 'integer', 100), setting('learning_rate', 'Learning Rate', 'number', 0.1), setting('random_state', 'Random State', 'integer', 42)]

    def build_model(self, settings):
        return HistGradientBoostingClassifier(max_iter=int(settings.get('max_iter') or 100), learning_rate=float(settings.get('learning_rate') or 0.1), random_state=int(settings.get('random_state') or 42))


class KNNClassifierNode(_ClassificationModelNode):
    id = 'MC-007'
    name = 'KNN Classifier'
    description = 'Trains a k-nearest-neighbors classifier.'
    settings_schema = COMMON_SETTINGS + [setting('n_neighbors', 'Neighbors', 'integer', 5), setting('weights', 'Weights', 'select', 'uniform', options=['uniform', 'distance'])]

    def build_model(self, settings):
        return KNeighborsClassifier(n_neighbors=int(settings.get('n_neighbors') or 5), weights=str(settings.get('weights') or 'uniform'))


class SVCClassifierNode(_ClassificationModelNode):
    id = 'MC-008'
    name = 'SVC Classifier'
    description = 'Trains a support-vector classifier.'
    settings_schema = COMMON_SETTINGS + [setting('C', 'C', 'number', 1.0), setting('kernel', 'Kernel', 'select', 'rbf', options=['rbf', 'linear', 'poly', 'sigmoid'])]

    def build_model(self, settings):
        return SVC(C=float(settings.get('C') or 1.0), kernel=str(settings.get('kernel') or 'rbf'))


class LinearSVCClassifierNode(_ClassificationModelNode):
    id = 'MC-009'
    name = 'Linear SVC Classifier'
    description = 'Trains a linear support-vector classifier.'
    settings_schema = COMMON_SETTINGS + [setting('C', 'C', 'number', 1.0), setting('max_iter', 'Max Iterations', 'integer', 5000)]

    def build_model(self, settings):
        return LinearSVC(C=float(settings.get('C') or 1.0), max_iter=int(settings.get('max_iter') or 5000))


class GaussianNBClassifierNode(_ClassificationModelNode):
    id = 'MC-010'
    name = 'Gaussian NB Classifier'
    description = 'Trains a Gaussian Naive Bayes classifier.'

    def build_model(self, settings):
        return GaussianNB()


# Backward-compatible class names used by older imports/aliases.
LinearModelNode = LinearRegressionNode
RandomForestModelNode = RandomForestRegressorNode
DecisionTreeModelNode = DecisionTreeRegressorNode
GradientBoostingModelNode = GradientBoostingRegressorNode
KNNModelNode = KNNRegressorNode
