"""Training-only preprocessing configuration and leakage guards."""
from __future__ import annotations

from app.nodes.base import BaseNode, port, setting
from app.workflow.contracts.errors import NodeContractError


def require_unfitted_input(payload):
    if payload and payload.meta.get('fitted_preprocessing'):
        raise NodeContractError(
            'PREPROCESSING_LEAKAGE',
            'This input was preprocessed before splitting. Split the original data first, then add Training Preprocessor.',
            category='data',
            suggested_fix='Connect original data → Train/Test or K-Fold Split → Training Preprocessor → Model.',
        )


class TrainingPreprocessorNode(BaseNode):
    id = 'MP-005'
    name = 'Training Preprocessor'
    category = 'ML Data Processing'
    description = 'Imputation and scaling fitted only on training rows, separately in every fold; reused for prediction.'
    inputs = [port('training', 'Split / Folds', 'any')]
    outputs = [port('training', 'Training Data', 'any')]
    settings_schema = [
        setting('imputation', 'Missing Numeric Values', 'select', 'median', options=['mean', 'median', 'most_frequent', 'constant']),
        setting('scaling', 'Scaling', 'select', 'standard', options=['none', 'standard', 'minmax', 'robust', 'maxabs']),
    ]

    def run(self, node, inputs, settings, context):
        source = next((v for k, v in inputs.items() if not k.startswith('_') and isinstance(v, dict)
                       and ('split_data' in v or 'kfold_data' in v)), None)
        if source is None:
            raise ValueError('Connect Train/Test Split or K-Fold Split to Training Preprocessor.')
        spec = {'imputation': settings.get('imputation', 'median'), 'scaling': settings.get('scaling', 'standard')}
        if spec['imputation'] not in {'mean', 'median', 'most_frequent', 'constant'} or spec['scaling'] not in {'none', 'standard', 'minmax', 'robust', 'maxabs'}:
            raise ValueError('Unsupported training preprocessing method.')
        result = dict(source)
        for key in ('split_data', 'kfold_data'):
            if key in source:
                result[key] = {**source[key], 'preprocessing': spec}
        return {**result, 'outputs_by_port': {'training': result}}
