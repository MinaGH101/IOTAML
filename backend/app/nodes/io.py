from __future__ import annotations

import json
import math
import tempfile
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.nodes.types import DataFramePayload, JsonPayload, ModelPayload, PlotPayload, FilePayload


def safe_json(value: Any) -> Any:
    if isinstance(value, DataFramePayload):
        return value.public_meta()
    if isinstance(value, JsonPayload):
        return {'data': safe_json(value.data), 'schema': safe_json(value.schema), 'source_node': value.source_node, 'meta': safe_json(value.meta)}
    if isinstance(value, ModelPayload):
        return {'features': value.features, 'target': value.target, 'metrics': safe_json(value.metrics), 'meta': safe_json(value.meta)}
    if isinstance(value, PlotPayload):
        return {'kind': value.kind, 'spec': safe_json(value.spec), 'source_node': value.source_node, 'meta': safe_json(value.meta)}
    if isinstance(value, FilePayload):
        return {'path': str(value.path), 'name': value.name, 'mime_type': value.mime_type, 'meta': safe_json(value.meta)}
    if is_dataclass(value):
        return safe_json(asdict(value))
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return None if math.isnan(float(value)) else float(value)
    if isinstance(value, np.ndarray):
        return [safe_json(v) for v in value.tolist()]
    if isinstance(value, pd.Series):
        return {str(k): safe_json(v) for k, v in value.to_dict().items()}
    if isinstance(value, pd.DataFrame):
        return json.loads(value.where(value.notna(), None).to_json(orient='records'))
    if isinstance(value, dict):
        return {str(k): safe_json(v) for k, v in value.items() if k != '_df'}
    if isinstance(value, (list, tuple)):
        return [safe_json(v) for v in value]
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    return value


def output(node_id: str, title: str, kind: str, **payload: Any) -> dict[str, Any]:
    return safe_json({'node_id': node_id, 'title': title, 'kind': kind, **payload})


def table_output(node_id: str, title: str, df: pd.DataFrame, max_rows: int = 100) -> dict[str, Any]:
    preview = df.head(max_rows).copy()
    return output(
        node_id,
        title,
        'table',
        rows_total=len(df),
        columns_total=len(df.columns),
        columns=[str(c) for c in preview.columns],
        rows=preview.to_dict(orient='records'),
    )


def metrics_output(node_id: str, title: str, metrics: dict[str, Any]) -> dict[str, Any]:
    return output(node_id, title, 'metrics', metrics=metrics)


def json_output(node_id: str, title: str, value: Any) -> dict[str, Any]:
    return output(node_id, title, 'json', value=value)


def node_label(node: dict[str, Any]) -> str:
    data = node.get('data') or {}
    return str(data.get('label') or data.get('typeLabel') or data.get('registryId') or node.get('type') or node.get('id'))


def input_by_port(inputs: dict[str, Any], port_id: str) -> list[dict[str, Any]]:
    return list(((inputs.get('_by_port') or {}).get(port_id) or []))


def _candidate_inputs(inputs: dict[str, Any], port_id: str | None = None) -> list[Any]:
    if port_id:
        by_port = input_by_port(inputs, port_id)
        if by_port:
            return by_port
    return [value for key, value in inputs.items() if not str(key).startswith('_')]


def dataframe_payload(inputs: dict[str, Any], port_id: str | None = None) -> DataFramePayload | None:
    for item in _candidate_inputs(inputs, port_id):
        if isinstance(item, DataFramePayload):
            return item.copy()
        if not isinstance(item, dict):
            continue
        for key in ('dataframe', 'dataframe_payload', 'payload'):
            value = item.get(key)
            if isinstance(value, DataFramePayload):
                return value.copy()
        if isinstance(item.get('_df'), pd.DataFrame):
            return DataFramePayload(
                df=item['_df'].copy(),
                id_column=item.get('_id_column') or (item.get('dataframe_meta') or {}).get('id_column'),
                meta=dict(item.get('dataframe_meta') or {}),
            )
        if isinstance(item.get('dataframe'), pd.DataFrame):
            return DataFramePayload(
                df=item['dataframe'].copy(),
                id_column=item.get('_id_column') or (item.get('dataframe_meta') or {}).get('id_column'),
                meta=dict(item.get('dataframe_meta') or {}),
            )
    return None


def dataframe_result(df: pd.DataFrame, id_column: str | None = None, meta: dict[str, Any] | None = None, **extra: Any) -> dict[str, Any]:
    payload = DataFramePayload(df=df, id_column=id_column, meta=meta or {})
    result = {
        'dataframe': payload,
        'dataframe_meta': payload.public_meta(),
        '_df': df,
        '_id_column': id_column,
    }
    result.update(extra)
    return result


def first_upstream_df(inputs: dict[str, Any], port_id: str | None = None) -> pd.DataFrame | None:
    payload = dataframe_payload(inputs, port_id)
    return payload.df.copy() if payload else None


def first_upstream_id_column(inputs: dict[str, Any], port_id: str | None = None) -> str | None:
    payload = dataframe_payload(inputs, port_id)
    if not payload or not payload.id_column:
        return None
    return payload.id_column if payload.id_column in payload.df.columns else None


def all_dataframe_payloads(inputs: dict[str, Any], port_id: str | None = None) -> list[DataFramePayload]:
    payloads: list[DataFramePayload] = []
    for item in _candidate_inputs(inputs, port_id):
        temp_inputs = {'x': item}
        payload = dataframe_payload(temp_inputs)
        if payload:
            payloads.append(payload)
    return payloads


def all_upstream_dfs(inputs: dict[str, Any], port_id: str | None = None) -> list[pd.DataFrame]:
    return [payload.df.copy() for payload in all_dataframe_payloads(inputs, port_id)]


def first_json_payload(inputs: dict[str, Any], port_id: str | None = None) -> Any:
    for item in _candidate_inputs(inputs, port_id):
        if isinstance(item, JsonPayload):
            return item.data
        if not isinstance(item, dict):
            continue
        for key in ('missing_report', 'profile_report', 'criteria', 'report', 'json', 'metrics', 'schema'):
            if key in item:
                value = item[key]
                return value.data if isinstance(value, JsonPayload) else value
        out = item.get('output')
        if isinstance(out, dict):
            if 'value' in out:
                return out['value']
            if 'rows' in out:
                return out['rows']
            if 'metrics' in out:
                return out['metrics']
    return None


def first_model_payload(inputs: dict[str, Any]) -> ModelPayload | None:
    for item in _candidate_inputs(inputs):
        if isinstance(item, ModelPayload):
            return item
        if isinstance(item, dict):
            value = item.get('model')
            if isinstance(value, ModelPayload):
                return value
            if value is not None:
                return ModelPayload(
                    model=value,
                    features=list(item.get('feature_columns') or []),
                    target=item.get('target_column'),
                    metrics=dict(item.get('metrics') or {}),
                    meta=dict(item.get('meta') or {}),
                )
    return None


def first_model(inputs: dict[str, Any]) -> Any:
    payload = first_model_payload(inputs)
    return payload.model if payload else None


def ensure_df(df: pd.DataFrame | None, node_id: str) -> pd.DataFrame:
    if df is None:
        raise ValueError(f'Node {node_id} requires dataframe input.')
    if df.empty:
        raise ValueError(f'Node {node_id} received an empty dataframe.')
    return df.copy()


def numeric_df(df: pd.DataFrame) -> pd.DataFrame:
    converted = df.copy()
    for col in converted.columns:
        if converted[col].dtype == object:
            cleaned = converted[col].astype(str).str.replace(',', '', regex=False).str.replace('<', '', regex=False).str.strip()
            converted[col] = pd.to_numeric(cleaned, errors='coerce')
    return converted.select_dtypes(include=[np.number])


def coerce_numeric_series(df: pd.DataFrame, column: str) -> pd.Series:
    return pd.to_numeric(
        df[column].astype(str).str.replace(',', '', regex=False).str.replace('<', '', regex=False).str.strip(),
        errors='coerce',
    )


def selected_columns(settings: dict[str, Any], df: pd.DataFrame) -> list[str]:
    for key in ('columns', 'selected_columns', 'feature_columns', 'column_names'):
        value = settings.get(key)
        if isinstance(value, list):
            return [str(c) for c in value if str(c) in df.columns]
        if isinstance(value, str) and value.strip():
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [str(c) for c in parsed if str(c) in df.columns]
            except Exception:
                pass
            return [c.strip() for c in value.split(',') if c.strip() in df.columns]
    single = settings.get('column')
    return [str(single)] if single and str(single) in df.columns else []



def parse_number_list(value: Any, default: list[float] | None = None) -> list[float]:
    """Parse comma/space separated numeric thresholds like '3,2' or '1.5, 2.5'."""
    if value in [None, '']:
        return default or []
    if isinstance(value, (int, float, np.integer, np.floating)):
        return [float(value)]
    if isinstance(value, (list, tuple, set)):
        raw_items = list(value)
    else:
        raw_items = str(value).replace(';', ',').split(',')
    numbers: list[float] = []
    for item in raw_items:
        text = str(item).strip()
        if not text:
            continue
        try:
            numbers.append(float(text))
        except ValueError as exc:
            raise ValueError(f'Invalid numeric threshold: {text}') from exc
    return numbers or (default or [])

def read_dataset(dataset_id: Any) -> pd.DataFrame:
    from app.database import SessionLocal
    from app.models import Dataset
    if not dataset_id:
        raise ValueError('Select a dataset in the workflow settings or Upload CSV/Excel node.')
    with SessionLocal() as db:
        dataset = db.get(Dataset, int(dataset_id))
        if not dataset:
            raise ValueError(f'Dataset not found: {dataset_id}')
        path = Path(dataset.path)
    suffix = path.suffix.lower()
    if suffix in {'.xlsx', '.xls'}:
        return pd.read_excel(path)
    if suffix == '.tsv':
        return pd.read_csv(path, sep='\t')
    return pd.read_csv(path)


def run_file_path(context: Any, node_id: str, suffix: str) -> Path:
    run_path = context.run_path or Path(tempfile.gettempdir())
    run_path.mkdir(parents=True, exist_ok=True)
    return run_path / f'{node_id}.{suffix.lstrip(".")}'
