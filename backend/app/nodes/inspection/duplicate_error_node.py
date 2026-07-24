from __future__ import annotations

from typing import Any, Callable

import numpy as np
import pandas as pd

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, dataframe_result, ensure_df, node_label, selected_columns, table_output
from app.nodes.table_file import read_uploaded_table

_METRIC_OPTIONS = [
    'pair_count', 'mae', 'mae_pct', 'rmse', 'mean_bias', 'median_absolute_error',
    'mean_rpd_pct', 'median_rpd_pct', 'max_rpd_pct',
    'mean_relative_bias_pct', 'pearson_r', 'spearman_rho', 'mean_pair_rsd_pct',
]


def _clean_id(value: Any, *, case_sensitive: bool) -> str:
    text = str(value).strip()
    return text if case_sensitive else text.casefold()


def _numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(
        series.astype(str).str.replace(',', '', regex=False).str.replace('<', '', regex=False).str.strip(),
        errors='coerce',
    )


def _safe_corr(a: pd.Series, b: pd.Series, method: str) -> float | None:
    if len(a) < 2 or a.nunique(dropna=True) < 2 or b.nunique(dropna=True) < 2:
        return None
    value = a.corr(b, method=method)
    return None if pd.isna(value) else float(value)


def _aggregate_metric(name: str, raw: pd.Series, duplicate: pd.Series) -> float | int | None:
    diff = duplicate - raw
    abs_diff = diff.abs()
    average_magnitude = (raw.abs() + duplicate.abs()) / 2
    rpd = (abs_diff / average_magnitude.replace(0, np.nan)) * 100
    relative_bias = (diff / raw.abs().replace(0, np.nan)) * 100
    pair_mean = (raw + duplicate) / 2
    pair_std = pd.concat([raw, duplicate], axis=1).std(axis=1, ddof=1)
    pair_rsd = (pair_std / pair_mean.abs().replace(0, np.nan)) * 100

    metrics: dict[str, Callable[[], Any]] = {
        'pair_count': lambda: int(len(raw)),
        'mae': lambda: float(abs_diff.mean()),
        # MAE expressed relative to the mean absolute raw-sample magnitude.
        # Zero-only raw series intentionally return null rather than infinity.
        'mae_pct': lambda: float((abs_diff.mean() / raw.abs().mean()) * 100),
        'rmse': lambda: float(np.sqrt(np.mean(np.square(diff)))),
        'mean_bias': lambda: float(diff.mean()),
        'median_absolute_error': lambda: float(abs_diff.median()),
        'mean_rpd_pct': lambda: float(rpd.mean()),
        'median_rpd_pct': lambda: float(rpd.median()),
        'max_rpd_pct': lambda: float(rpd.max()),
        'mean_relative_bias_pct': lambda: float(relative_bias.mean()),
        'pearson_r': lambda: _safe_corr(raw, duplicate, 'pearson'),
        'spearman_rho': lambda: _safe_corr(raw, duplicate, 'spearman'),
        'mean_pair_rsd_pct': lambda: float(pair_rsd.mean()),
    }
    value = metrics[name]()
    if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
        return None
    return value


def _resolve_mapping_columns(mapping: pd.DataFrame, raw_name: str, duplicate_name: str) -> tuple[str, str]:
    columns = list(mapping.columns)
    raw = raw_name.strip()
    duplicate = duplicate_name.strip()
    if raw and raw not in columns:
        raise ValueError(f'Raw mapping column "{raw}" was not found. Available columns: {", ".join(columns)}')
    if duplicate and duplicate not in columns:
        raise ValueError(f'Duplicate mapping column "{duplicate}" was not found. Available columns: {", ".join(columns)}')
    if not raw or not duplicate:
        if len(columns) < 2:
            raise ValueError('The mapping table must contain at least two columns.')
        raw = raw or columns[0]
        duplicate = duplicate or columns[1]
    if raw == duplicate:
        raise ValueError('Raw and duplicate mapping columns must be different.')
    return raw, duplicate


class DuplicateSampleErrorNode(BaseNode):
    id = 'IN-008'
    name = 'Duplicate Sample Error'
    category = 'Data Inspection'
    description = 'Calculates laboratory and geochemical duplicate-pair error metrics from a raw-to-duplicate ID mapping table.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('errors', 'Error Metrics', 'dataframe')]
    settings_schema = [
        setting('mapping_file', 'Raw / Duplicate Mapping', 'data_file', None, True, supports_dynamic=False, help='CSV, TSV, or XLSX with one raw ID column and one duplicate ID column.'),
        setting('mapping_raw_column', 'Raw Sample Mapping Column', 'text', '', help='Leave blank to use the first mapping column.'),
        setting('mapping_duplicate_column', 'Duplicate Sample Mapping Column', 'text', '', help='Leave blank to use the second mapping column.'),
        setting('dataframe_id_column', 'DataFrame Sample ID Column', 'column', None, False, help='Defaults to the inherited workflow ID. You may choose another original source column.'),
        setting('columns', 'Analyte / Measurement Columns', 'columns', [], help='Numeric columns for duplicate error calculation.'),
        setting('metrics', 'Error Metrics', 'multiselect', ['pair_count', 'mae', 'rmse', 'mean_rpd_pct', 'pearson_r'], options=_METRIC_OPTIONS),
        setting('case_sensitive_ids', 'Case-sensitive IDs', 'boolean', False, supports_dynamic=False),
        setting('duplicate_id_policy', 'Repeated DataFrame ID Policy', 'select', 'error', options=['error', 'first', 'mean_numeric'], supports_dynamic=False),
    ]
    cache_version = '3'

    def run(self, node: dict[str, Any], inputs: dict[str, Any], settings: dict[str, Any], context: Any) -> dict[str, Any]:
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))
        id_column = str(settings.get('dataframe_id_column') or (payload.id_column if payload else '') or '').strip()
        if not id_column:
            raise ValueError('Select a valid DataFrame sample ID column.')
        if payload:
            try:
                df = payload.frame_for_id(id_column)
            except ValueError as exc:
                raise ValueError('Select a valid DataFrame sample ID column.') from exc
        elif id_column not in df.columns:
            raise ValueError('Select a valid DataFrame sample ID column.')

        mapping, mapping_meta = read_uploaded_table(settings.get('mapping_file'))
        raw_mapping_col, duplicate_mapping_col = _resolve_mapping_columns(
            mapping,
            str(settings.get('mapping_raw_column') or ''),
            str(settings.get('mapping_duplicate_column') or ''),
        )
        mapping = mapping[[raw_mapping_col, duplicate_mapping_col]].dropna(how='any').copy()
        if mapping.empty:
            raise ValueError('No complete raw/duplicate ID pairs were found in the mapping table.')

        case_sensitive = bool(settings.get('case_sensitive_ids', False))
        policy = str(settings.get('duplicate_id_policy') or 'error')
        working = df.copy()
        working['__iota_pair_key'] = working[id_column].map(lambda value: _clean_id(value, case_sensitive=case_sensitive))
        duplicate_keys = working['__iota_pair_key'][working['__iota_pair_key'].duplicated(keep=False)]
        if not duplicate_keys.empty:
            if policy == 'error':
                examples = ', '.join(duplicate_keys.drop_duplicates().head(5).astype(str))
                raise ValueError(f'DataFrame ID column contains repeated IDs ({examples}). Choose first or mean_numeric, or clean the IDs first.')
            if policy == 'first':
                working = working.drop_duplicates('__iota_pair_key', keep='first')
            elif policy == 'mean_numeric':
                numeric_columns = [column for column in working.select_dtypes(include=[np.number]).columns if column != id_column]
                non_numeric = [column for column in working.columns if column not in numeric_columns and column != '__iota_pair_key']
                aggregations = {column: 'mean' for column in numeric_columns}
                aggregations.update({column: 'first' for column in non_numeric})
                working = working.groupby('__iota_pair_key', as_index=False).agg(aggregations)
            else:
                raise ValueError('Repeated DataFrame ID policy must be error, first, or mean_numeric.')

        indexed = working.set_index('__iota_pair_key', drop=False)
        mapping['__raw_key'] = mapping[raw_mapping_col].map(lambda value: _clean_id(value, case_sensitive=case_sensitive))
        mapping['__duplicate_key'] = mapping[duplicate_mapping_col].map(lambda value: _clean_id(value, case_sensitive=case_sensitive))
        valid_map = mapping[mapping['__raw_key'].isin(indexed.index) & mapping['__duplicate_key'].isin(indexed.index)].copy()
        missing_raw = mapping.loc[~mapping['__raw_key'].isin(indexed.index), raw_mapping_col].astype(str).tolist()
        missing_duplicate = mapping.loc[~mapping['__duplicate_key'].isin(indexed.index), duplicate_mapping_col].astype(str).tolist()
        if valid_map.empty:
            raise ValueError('None of the mapping IDs matched the selected DataFrame ID column.')

        selected = selected_columns(settings, df)
        if not selected:
            selected = [column for column in df.select_dtypes(include=[np.number]).columns if column != id_column]
        selected = [column for column in selected if column in df.columns and column != id_column]
        if not selected:
            raise ValueError('Select at least one numeric analyte or measurement column.')

        requested_metrics = settings.get('metrics') or []
        if isinstance(requested_metrics, str):
            requested_metrics = [item.strip() for item in requested_metrics.split(',') if item.strip()]
        metrics = [str(metric) for metric in requested_metrics if str(metric) in _METRIC_OPTIONS]
        if not metrics:
            raise ValueError('Select at least one duplicate error metric.')

        summary_rows: list[dict[str, Any]] = []
        for column in selected:
            raw_rows = indexed.loc[valid_map['__raw_key'], column]
            duplicate_rows = indexed.loc[valid_map['__duplicate_key'], column]
            raw_values = _numeric(pd.Series(raw_rows.to_numpy(), index=valid_map.index))
            duplicate_values = _numeric(pd.Series(duplicate_rows.to_numpy(), index=valid_map.index))
            valid = raw_values.notna() & duplicate_values.notna()
            raw_values = raw_values[valid]
            duplicate_values = duplicate_values[valid]
            summary = {'column': str(column)}
            if raw_values.empty:
                summary.update({metric: None for metric in metrics})
            else:
                summary.update({metric: _aggregate_metric(metric, raw_values, duplicate_values) for metric in metrics})
            summary_rows.append(summary)

        summary_df = pd.DataFrame(summary_rows)
        report = {
            'mapping_file': mapping_meta,
            'mapping_rows': int(len(mapping)),
            'matched_pairs': int(len(valid_map)),
            'missing_raw_count': len(missing_raw),
            'missing_duplicate_count': len(missing_duplicate),
            'dataframe_id_column': id_column,
            'analyzed_columns': selected,
            'metrics': metrics,
        }
        return dataframe_result(
            summary_df,
            id_column='column',
            meta={'duplicate_sample_error': report},
            reset_lineage=True,
            outputs_by_port={
                'errors': dataframe_result(
                    summary_df,
                    id_column='column',
                    meta={'duplicate_sample_error': report},
                    reset_lineage=True,
                )
            },
            output=table_output(str(node['id']), f'{node_label(node)} · Error Metrics', summary_df, 500),
        )
