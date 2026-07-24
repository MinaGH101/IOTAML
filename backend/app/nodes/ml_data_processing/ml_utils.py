from __future__ import annotations

from typing import Any

import pandas as pd

from app.nodes.io import calculation_columns, dataframe_payload, ensure_df, selected_columns


def feature_target_from_inputs(inputs: dict[str, Any], settings: dict[str, Any], context: Any, node_id: str):
    payload = dataframe_payload(inputs, 'data') or dataframe_payload(inputs)
    df = ensure_df(payload.df if payload else None, node_id)
    meta = payload.meta if payload else {}

    direct = None
    for value in [v for k, v in inputs.items() if not str(k).startswith('_')]:
        if isinstance(value, dict) and value.get('features_df') is not None and value.get('target_series') is not None:
            direct = value
            break

    if direct is not None:
        x = direct['features_df'].copy()
        y = direct['target_series'].copy()
        target = str(direct.get('target_column') or y.name or meta.get('target_column') or '')
        features = [str(c) for c in direct.get('feature_columns') or list(x.columns)]
        return x, y, target, features, payload

    target = str(settings.get('target_column') or meta.get('target_column') or context.target_column or '').strip()
    if not target or target not in calculation_columns(df):
        raise ValueError('Select target/features first or set a valid active target column. The workflow ID cannot be the target.')

    features = [c for c in selected_columns(settings, df) if c != target]
    if not features:
        features = [str(c) for c in meta.get('feature_columns') or [] if str(c) in df.columns and str(c) != target]
    if not features:
        features = [str(c) for c in calculation_columns(df) if str(c) != target]

    x = df[features].copy()
    y = df[target].copy()
    return x, y, target, features, payload


def training_frame(x: pd.DataFrame, y: pd.Series, target: str) -> pd.DataFrame:
    return pd.concat([x.reset_index(drop=True), y.reset_index(drop=True).rename(target)], axis=1)
