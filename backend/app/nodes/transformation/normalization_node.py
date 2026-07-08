from __future__ import annotations

import json
from typing import Any

import numpy as np
import pandas as pd
from sklearn.preprocessing import PowerTransformer, QuantileTransformer, normalize

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, dataframe_result, ensure_df, node_label, table_output


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


def _positive(series: pd.Series, offset: float):
    numeric = pd.to_numeric(series, errors='coerce') + offset
    min_value = numeric.min(skipna=True)
    if pd.notna(min_value) and min_value <= 0:
        numeric = numeric + abs(float(min_value)) + 1e-9
    return numeric


class NormalizationNode(BaseNode):
    id = 'TR-021'
    name = 'Normalization Blocks'
    category = 'Transformation'
    description = 'Normalizes selected columns using one or more method blocks.'

    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'Normalized DataFrame', 'dataframe'), port('report', 'Normalization Report', 'json')]

    settings_schema = [
        setting('normalization_blocks', 'Normalization Blocks', 'normalization_blocks', [], required=False, supports_dynamic=False),
        setting('max_output_rows', 'Max Output Rows', 'integer', 100),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id'])).copy()
        id_column = payload.id_column if payload else None
        blocks = _blocks(settings.get('normalization_blocks'))
        if not blocks:
            raise ValueError('Add at least one normalization block.')

        report_rows: list[dict[str, Any]] = []
        changed_cols: list[str] = []
        for block_index, block in enumerate(blocks, start=1):
            method = str(block.get('method') or 'ln')
            columns = _cols(block.get('columns'), df)
            offset = float(block.get('offset') or 0)
            if not columns:
                continue
            numeric = df[columns].apply(pd.to_numeric, errors='coerce')

            if method == 'ln':
                for col in columns:
                    df[col] = np.log(_positive(df[col], offset))
            elif method == 'log10':
                for col in columns:
                    df[col] = np.log10(_positive(df[col], offset))
            elif method == 'sqrt':
                for col in columns:
                    df[col] = np.sqrt(_positive(df[col], offset))
            elif method in {'boxcox', 'yeo_johnson'}:
                power_method = 'box-cox' if method == 'boxcox' else 'yeo-johnson'
                data = numeric.copy()
                if method == 'boxcox':
                    for col in columns:
                        data[col] = _positive(df[col], offset)
                transformer = PowerTransformer(method=power_method, standardize=bool(block.get('standardize', True)))
                df.loc[:, columns] = transformer.fit_transform(data)
            elif method == 'quantile_normal':
                transformer = QuantileTransformer(n_quantiles=min(int(block.get('n_quantiles') or 1000), len(df)), output_distribution='normal', random_state=int(block.get('random_state') or 42))
                df.loc[:, columns] = transformer.fit_transform(numeric)
            elif method in {'l1', 'l2', 'max'}:
                df.loc[:, columns] = normalize(numeric.fillna(0), norm=method)
            else:
                raise ValueError(f'Unsupported normalization method: {method}')

            changed_cols.extend(columns)
            for col in columns:
                report_rows.append({'block': block_index, 'column': col, 'method': method, 'offset': offset})

        changed_cols = list(dict.fromkeys(changed_cols))
        preview_cols = ([id_column] if id_column and id_column in df.columns else []) + changed_cols
        preview_df = df[preview_cols].head(int(settings.get('max_output_rows') or 100)).copy() if preview_cols else df.head(0)
        if id_column and id_column in preview_df.columns:
            preview_df = preview_df.rename(columns={id_column: 'id'})
        report = {'blocks': len(blocks), 'normalized_columns': changed_cols, 'normalized_column_count': len(changed_cols), 'details': report_rows}
        return dataframe_result(
            df,
            id_column=id_column if id_column in df.columns else None,
            meta={**(payload.meta if payload else {}), 'normalized_columns': changed_cols},
            report=report,
            json=report,
            output=table_output(str(node['id']), f'{node_label(node)} · Normalized Table', preview_df, int(settings.get('max_output_rows') or 100)),
            outputs=[table_output(str(node['id']), f'{node_label(node)} · Normalization Report', pd.DataFrame(report_rows), 200), table_output(str(node['id']), f'{node_label(node)} · Normalized Table', preview_df, int(settings.get('max_output_rows') or 100))],
        )
