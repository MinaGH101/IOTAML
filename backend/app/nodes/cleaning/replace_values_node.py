from __future__ import annotations

import json
import re
from typing import Any

import numpy as np
import pandas as pd

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


def _as_columns(value: Any, df: pd.DataFrame) -> list[str]:
    if isinstance(value, list):
        return [str(c) for c in value if str(c) in df.columns]
    if isinstance(value, str):
        return [c.strip() for c in value.split(',') if c.strip() in df.columns]
    return []


def _typed_mask(series: pd.Series, value_type: str) -> pd.Series:
    if value_type == 'missing':
        return series.isna()
    if value_type == 'string':
        return series.map(lambda value: isinstance(value, str), na_action='ignore').fillna(False)
    if value_type == 'int':
        numeric = pd.to_numeric(series, errors='coerce')
        return numeric.notna() & np.isclose(numeric % 1, 0)
    if value_type == 'float':
        numeric = pd.to_numeric(series, errors='coerce')
        return numeric.notna() & ~np.isclose(numeric % 1, 0)
    if value_type == 'numeric':
        return pd.to_numeric(series, errors='coerce').notna()
    return pd.Series(False, index=series.index)


def _value_mask(series: pd.Series, condition: str, find_value: Any) -> pd.Series:
    text = '' if find_value is None else str(find_value)
    as_text = series.astype(str)

    if condition == 'include':
        return as_text.str.contains(re.escape(text), case=False, na=False)
    if condition == 'starts_with':
        return as_text.str.startswith(text, na=False)
    if condition == 'ends_with':
        return as_text.str.endswith(text, na=False)
    if condition == 'regex':
        return as_text.str.contains(text, regex=True, na=False)

    if condition in {'>', '>=', '<', '<='}:
        numeric = pd.to_numeric(series.astype(str).str.replace(',', '', regex=False).str.replace('<', '', regex=False).str.strip(), errors='coerce')
        threshold = float(text)
        if condition == '>':
            return numeric > threshold
        if condition == '>=':
            return numeric >= threshold
        if condition == '<':
            return numeric < threshold
        return numeric <= threshold

    return as_text.eq(text)


def _replacement_value(block: dict[str, Any]) -> Any:
    mode = str(block.get('replacement_mode') or 'value')
    if mode == 'none':
        return None
    value = block.get('replacement_value')
    if value == 'None':
        return None
    return value


class ReplaceValuesNode(BaseNode):
    id = 'CL-008'
    name = 'Replace Values'
    category = 'Data Cleaning'
    description = 'Replaces values in selected columns using one or more replacement blocks.'

    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'Cleaned DataFrame', 'dataframe'), port('report', 'Replacement Report', 'json')]

    settings_schema = [
        setting('replacement_blocks', 'Replacement Blocks', 'replacement_blocks', [], required=False, supports_dynamic=False),
        setting('max_output_rows', 'Max Output Rows', 'integer', 100),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id'])).copy()
        id_column = payload.id_column if payload else None
        blocks = _blocks(settings.get('replacement_blocks'))
        if not blocks:
            raise ValueError('Add at least one replacement block.')

        report: list[dict[str, Any]] = []
        changed_indexes: set[Any] = set()

        for block_index, block in enumerate(blocks, start=1):
            columns = _as_columns(block.get('columns'), df)
            if not columns:
                continue

            find_mode = str(block.get('find_mode') or 'value')
            condition = str(block.get('condition') or 'match')
            value_type = str(block.get('value_type') or 'any')
            find_value = block.get('find_value')
            replacement = _replacement_value(block)

            for col in columns:
                mask = _typed_mask(df[col], value_type) if find_mode == 'type' else _value_mask(df[col], condition, find_value)
                count = int(mask.sum())
                if count:
                    changed_indexes.update(df.index[mask].tolist())
                    df.loc[mask, col] = replacement
                report.append({
                    'block': block_index,
                    'column': str(col),
                    'find_mode': find_mode,
                    'condition': condition if find_mode == 'value' else None,
                    'find_value': safe_json(find_value) if find_mode == 'value' else None,
                    'value_type': value_type if find_mode == 'type' else None,
                    'replacement': None if replacement is None else safe_json(replacement),
                    'replaced_rows': count,
                })

        preview_df = df.loc[sorted(changed_indexes)].head(int(settings.get('max_output_rows') or 100)) if changed_indexes else df.head(0)
        if id_column and id_column in preview_df.columns:
            preview_df = preview_df.rename(columns={id_column: 'id'})

        replacement_report = {
            'blocks': len(blocks),
            'changed_rows': len(changed_indexes),
            'details': report,
        }
        preview = table_output(str(node['id']), f'{node_label(node)} · Changed Rows', preview_df, int(settings.get('max_output_rows') or 100))
        preview['summary'] = replacement_report

        return dataframe_result(
            df,
            id_column=id_column if id_column in df.columns else None,
            meta={**(payload.meta if payload else {}), 'replacement_blocks': len(blocks)},
            report=replacement_report,
            json=replacement_report,
            output=preview,
            outputs=[table_output(str(node['id']), f'{node_label(node)} · Replacement Report', pd.DataFrame(report), 100), preview],
        )
