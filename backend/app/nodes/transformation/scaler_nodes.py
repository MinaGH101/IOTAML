from __future__ import annotations

import pandas as pd
from sklearn.preprocessing import MaxAbsScaler, MinMaxScaler, RobustScaler, StandardScaler

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, dataframe_result, ensure_df, node_label, selected_columns, table_output


def _bool(value, default: bool = True) -> bool:
    if value in [None, '']:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {'1', 'true', 'yes', 'y', 'on'}


class ScalerNode(BaseNode):
    id = 'TR-020'
    name = 'Scaler'
    category = 'Transformation'
    description = 'Scales selected numeric columns using the selected scaler method.'

    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'Scaled DataFrame', 'dataframe'), port('report', 'Scaler Report', 'json')]

    settings_schema = [
        setting('columns', 'Columns', 'columns', []),
        setting('method', 'Scaling Method', 'select', 'standard', options=['standard', 'minmax', 'robust', 'maxabs']),
        setting('standard_mode', 'Standard Mode', 'select', 'mean_std', options=['mean_std', 'std_only', 'mean_only', 'none']),
        setting('feature_min', 'MinMax: Feature Min', 'number', 0),
        setting('feature_max', 'MinMax: Feature Max', 'number', 1),
        setting('quantile_min', 'Robust: Quantile Min', 'number', 25),
        setting('quantile_max', 'Robust: Quantile Max', 'number', 75),
        setting('robust_mode', 'Robust Mode', 'select', 'center_scale', options=['center_scale', 'scale_only', 'center_only', 'none']),
        setting('max_output_rows', 'Max Output Rows', 'integer', 100),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))
        id_column = payload.id_column if payload else None

        columns = selected_columns(settings, df)
        if not columns:
            columns = [str(c) for c in df.select_dtypes(include='number').columns if str(c) != id_column]
        if not columns:
            raise ValueError('Select at least one numeric column to scale.')

        numeric = df[columns].apply(pd.to_numeric, errors='coerce')
        method = str(settings.get('method') or 'standard')

        scaler_settings: dict[str, object] = {}

        if method == 'minmax':
            feature_min = float(settings.get('feature_min') if settings.get('feature_min') not in [None, ''] else 0)
            feature_max = float(settings.get('feature_max') if settings.get('feature_max') not in [None, ''] else 1)
            scaler = MinMaxScaler(feature_range=(feature_min, feature_max))
            scaler_settings = {'feature_min': feature_min, 'feature_max': feature_max}

        elif method == 'robust':
            robust_mode = str(settings.get('robust_mode') or 'center_scale')
            with_centering = robust_mode in {'center_scale', 'center_only'}
            with_scaling = robust_mode in {'center_scale', 'scale_only'}
            q_min = float(settings.get('quantile_min') if settings.get('quantile_min') not in [None, ''] else 25)
            q_max = float(settings.get('quantile_max') if settings.get('quantile_max') not in [None, ''] else 75)
            scaler = RobustScaler(
                quantile_range=(q_min, q_max),
                with_centering=with_centering,
                with_scaling=with_scaling,
            )
            scaler_settings = {'robust_mode': robust_mode, 'quantile_min': q_min, 'quantile_max': q_max}

        elif method == 'maxabs':
            scaler = MaxAbsScaler()

        else:
            # New UI uses standard_mode. Old workflows may still have with_mean / with_std.
            standard_mode = str(settings.get('standard_mode') or '')
            if standard_mode:
                with_mean = standard_mode in {'mean_std', 'mean_only'}
                with_std = standard_mode in {'mean_std', 'std_only'}
            else:
                with_mean = _bool(settings.get('with_mean'), True)
                with_std = _bool(settings.get('with_std'), True)
                if with_mean and with_std:
                    standard_mode = 'mean_std'
                elif with_std:
                    standard_mode = 'std_only'
                elif with_mean:
                    standard_mode = 'mean_only'
                else:
                    standard_mode = 'none'

            scaler = StandardScaler(with_mean=with_mean, with_std=with_std)
            scaler_settings = {'standard_mode': standard_mode, 'with_mean': with_mean, 'with_std': with_std}

        scaled = pd.DataFrame(scaler.fit_transform(numeric), index=df.index, columns=columns)
        for col in columns:
            df[col] = scaled[col].astype(float)

        max_rows = int(settings.get('max_output_rows') or 100)
        preview_cols = ([id_column] if id_column and id_column in df.columns else []) + columns
        preview_df = df[preview_cols].head(max_rows).copy()
        if id_column and id_column in preview_df.columns:
            preview_df = preview_df.rename(columns={id_column: 'id'})

        report = {
            'method': method,
            **scaler_settings,
            'scaled_column_count': len(columns),
            'rows': int(len(df)),
        }

        return dataframe_result(
            df,
            id_column=id_column if id_column and id_column in df.columns else None,
            meta={**(payload.meta if payload else {}), 'scaled_columns': columns, 'scaler_method': method},
            report=report,
            json=report,
            output=table_output(str(node['id']), f'{node_label(node)} · Scaled Table', preview_df, max_rows),
        )


# Backward-compatible aliases for old workflows.
StandardScalerNode = ScalerNode
MinMaxScalerNode = ScalerNode
