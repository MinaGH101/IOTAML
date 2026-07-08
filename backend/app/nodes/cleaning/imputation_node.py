from __future__ import annotations

import json
from typing import Any

import numpy as np
import pandas as pd
from sklearn.impute import KNNImputer

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, dataframe_result, ensure_df, node_label, safe_json, table_output


def _blocks(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [b for b in value if isinstance(b, dict)]
    if isinstance(value, str) and value.strip():
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [b for b in parsed if isinstance(b, dict)]
    return []


def _cols(value: Any, df: pd.DataFrame) -> list[str]:
    if isinstance(value, list):
        return [str(c) for c in value if str(c) in df.columns]
    if isinstance(value, str):
        return [c.strip() for c in value.split(',') if c.strip() in df.columns]
    return []


def _constant_value(value: Any) -> Any:
    if value in [None, '']:
        return 0
    if str(value).lower() in {'none', 'null', 'nan'}:
        return np.nan
    try:
        return float(value)
    except Exception:
        return value


class ImputationNode(BaseNode):
    id = 'CL-009'
    name = 'Imputation'
    category = 'Data Cleaning'
    description = 'Imputes missing values using one or more method blocks.'

    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'Imputed DataFrame', 'dataframe'), port('report', 'Imputation Report', 'json')]

    settings_schema = [
        setting('imputation_blocks', 'Imputation Blocks', 'imputation_blocks', [], required=False, supports_dynamic=False),
        setting('max_output_rows', 'Max Output Rows', 'integer', 100),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id'])).copy()
        id_column = payload.id_column if payload else None
        blocks = _blocks(settings.get('imputation_blocks'))
        if not blocks:
            raise ValueError('Add at least one imputation block.')

        changed_rows: set[Any] = set()
        report_rows: list[dict[str, Any]] = []

        for block_index, block in enumerate(blocks, start=1):
            method = str(block.get('method') or 'mean')
            columns = _cols(block.get('columns'), df)
            if not columns:
                continue

            before_missing = {col: int(df[col].isna().sum()) for col in columns}
            missing_mask_before = df[columns].isna().any(axis=1)

            if method in {'mean', 'median'}:
                for col in columns:
                    numeric = pd.to_numeric(df[col], errors='coerce')
                    value = numeric.mean() if method == 'mean' else numeric.median()
                    df[col] = numeric.fillna(value)
            elif method == 'constant':
                value = _constant_value(block.get('constant_value'))
                for col in columns:
                    df[col] = df[col].fillna(value)
            elif method == 'interpolate':
                interpolation_method = str(block.get('interpolation_method') or 'linear')
                limit_direction = str(block.get('limit_direction') or 'both')
                for col in columns:
                    numeric = pd.to_numeric(df[col], errors='coerce')
                    df[col] = numeric.interpolate(method=interpolation_method, limit_direction=limit_direction)
            elif method == 'knn':
                numeric = df[columns].apply(pd.to_numeric, errors='coerce')
                n_neighbors = int(block.get('n_neighbors') or 5)
                weights = str(block.get('weights') or 'uniform')
                imputer = KNNImputer(n_neighbors=n_neighbors, weights=weights)
                df.loc[:, columns] = imputer.fit_transform(numeric)
            else:
                raise ValueError(f'Unsupported imputation method: {method}')

            after_missing = {col: int(df[col].isna().sum()) for col in columns}
            changed_rows.update(df.index[missing_mask_before].tolist())

            for col in columns:
                report_rows.append({
                    'block': block_index,
                    'column': col,
                    'method': method,
                    'missing_before': before_missing[col],
                    'missing_after': after_missing[col],
                    'imputed_values': max(0, before_missing[col] - after_missing[col]),
                    'settings': safe_json({k: v for k, v in block.items() if k not in {'columns'}}),
                })

        max_rows = int(settings.get('max_output_rows') or 100)
        preview_df = df.loc[sorted(changed_rows)].head(max_rows) if changed_rows else df.head(0)
        if id_column and id_column in preview_df.columns:
            preview_df = preview_df.rename(columns={id_column: 'id'})
        report = {'blocks': len(blocks), 'changed_rows': len(changed_rows), 'details': report_rows}
        return dataframe_result(
            df,
            id_column=id_column if id_column in df.columns else None,
            meta={**(payload.meta if payload else {}), 'imputation_blocks': len(blocks)},
            report=report,
            json=report,
            output=table_output(str(node['id']), f'{node_label(node)} · Imputed Rows', preview_df, max_rows),
            outputs=[table_output(str(node['id']), f'{node_label(node)} · Imputation Report', pd.DataFrame(report_rows), 200), table_output(str(node['id']), f'{node_label(node)} · Imputed Rows', preview_df, max_rows)],
        )
