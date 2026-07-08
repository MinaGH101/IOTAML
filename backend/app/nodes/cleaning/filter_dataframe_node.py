from __future__ import annotations

import json
import operator
from typing import Any

import pandas as pd

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, dataframe_result, ensure_df, first_json_payload, node_label, table_output

OPS = {
    '=': operator.eq,
    '==': operator.eq,
    '!=': operator.ne,
    '>': operator.gt,
    '>=': operator.ge,
    '<': operator.lt,
    '<=': operator.le,
    'contains': lambda a, b: str(a).str.contains(str(b), case=False, na=False) if hasattr(a, 'str') else str(b).lower() in str(a).lower(),
    'not_contains': lambda a, b: ~str(a).str.contains(str(b), case=False, na=False) if hasattr(a, 'str') else str(b).lower() not in str(a).lower(),
}


def _parse_conditions(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        return json.loads(value)
    return {'logic': 'AND', 'groups': []}


def _check_condition(row: dict[str, Any], cond: dict[str, Any]) -> bool:
    field = str(cond.get('field') or '')
    op = str(cond.get('operator') or '==')
    expected = cond.get('value')
    actual = row.get(field)
    try:
        if isinstance(actual, str) and isinstance(expected, (int, float)):
            actual = float(actual)
    except Exception:
        pass
    return bool(OPS.get(op, operator.eq)(actual, expected))


def _check_group(row: dict[str, Any], group: dict[str, Any]) -> bool:
    logic = str(group.get('logic') or 'AND').upper()
    checks = [_check_condition(row, c) for c in group.get('conditions') or []]
    return any(checks) if logic == 'OR' else all(checks)


def _check_rule(row: dict[str, Any], rule: dict[str, Any]) -> bool:
    groups = rule.get('groups') or []
    if not groups and rule.get('conditions'):
        groups = [{'logic': rule.get('logic') or 'AND', 'conditions': rule.get('conditions')}]
    if not groups:
        return True
    checks = [_check_group(row, g) for g in groups]
    return any(checks) if str(rule.get('logic') or 'AND').upper() == 'OR' else all(checks)


def _coerce_value(value: Any) -> Any:
    text = str(value).strip()
    if text.lower() in {'true', 'false'}:
        return text.lower() == 'true'
    try:
        return float(text)
    except Exception:
        return value


def _series_filter(series: pd.Series, op: str, raw_value: Any) -> pd.Series:
    value = _coerce_value(raw_value)
    numeric = pd.to_numeric(series.astype(str).str.replace(',', '', regex=False).str.strip(), errors='coerce')
    use_numeric = isinstance(value, (int, float)) and numeric.notna().any()
    left = numeric if use_numeric else series

    if op == '>':
        return left > value
    if op == '>=':
        return left >= value
    if op == '<':
        return left < value
    if op == '<=':
        return left <= value
    if op == '!=':
        return left != value
    if op == 'contains':
        return series.astype(str).str.contains(str(raw_value), case=False, na=False)
    if op == 'not_contains':
        return ~series.astype(str).str.contains(str(raw_value), case=False, na=False)
    return left == value


class FilterDataFrameNode(BaseNode):
    id = 'CL-007'
    name = 'Data Filter'
    category = 'Data Cleaning'
    description = 'Filters rows or columns using a simple condition, pandas query, or a JSON report from another node.'

    inputs = [
        port('data', 'DataFrame to filter', 'dataframe'),
        port('criteria', 'Criteria / Report', 'json', required=False),
    ]

    outputs = [
        port('dataframe', 'Filtered DataFrame', 'dataframe'),
    ]

    settings_schema = [
        setting('filter_target', 'Filter Target', 'select', 'rows', options=['rows', 'columns']),
        setting('column', 'Column', 'column', '', required=False),
        setting('operator', 'Operator', 'select', '>', options=['>', '>=', '<', '<=', '==', '!=', 'contains', 'not_contains']),
        setting('value', 'Value', 'text', '', required=False),
        setting('row_query', 'Row Query', 'text', '', required=False, help='Optional pandas query. If set, it is applied before the simple condition.'),
        setting('match_key', 'Report Match Key', 'select', 'column', options=['column', 'column_name', 'row_index', 'id']),
        setting('conditions', 'Report Condition Blocks JSON', 'json', '{"logic":"AND","groups":[]}', required=False),
        setting('max_output_rows', 'Max Output Rows', 'integer', 100, required=False),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))
        target = str(settings.get('filter_target') or 'rows')
        max_rows = int(settings.get('max_output_rows') or 100)

        if target == 'rows':
            next_df = df.copy()
            query = str(settings.get('row_query') or '').strip()
            if query:
                next_df = next_df.query(query)

            col = str(settings.get('column') or '').strip()
            raw_value = settings.get('value')
            if col:
                if col not in next_df.columns:
                    raise ValueError(f'Filter column not found: {col}')
                op = str(settings.get('operator') or '==')
                flags = _series_filter(next_df[col], op, raw_value).fillna(False)
                next_df = next_df[flags]

            return dataframe_result(
                next_df,
                id_column=payload.id_column if payload else None,
                meta=payload.meta if payload else {},
                output=table_output(str(node['id']), node_label(node), next_df, max_rows),
            )

        criteria = first_json_payload(inputs, 'criteria') or {}
        rows = criteria.get('columns') or criteria.get('summary') or criteria.get('rows') or [] if isinstance(criteria, dict) else criteria if isinstance(criteria, list) else []
        rule = _parse_conditions(settings.get('conditions'))
        match_key = str(settings.get('match_key') or 'column')
        keep_names = []
        for row in rows:
            if not isinstance(row, dict) or not _check_rule(row, rule):
                continue
            name = row.get(match_key) or row.get('column') or row.get('column_name')
            if name in df.columns:
                keep_names.append(name)

        next_df = df[[name for name in keep_names if name in df.columns]].copy() if keep_names else df.copy()
        id_column = payload.id_column if payload and payload.id_column in next_df.columns else None
        return dataframe_result(
            next_df,
            id_column=id_column,
            meta=payload.meta if payload else {},
            output=table_output(str(node['id']), node_label(node), next_df, max_rows),
        )
