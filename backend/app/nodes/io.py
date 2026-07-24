from __future__ import annotations

import json
import math
import tempfile
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.nodes.types import DataFrameLineage, DataFramePayload, JsonPayload, ModelPayload, PlotPayload, FilePayload


DATAFRAME_CONTRACT_VERSION = 3


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
        return {str(k): safe_json(v) for k, v in value.items() if not str(k).startswith('_')}
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
            return item
        if not isinstance(item, dict):
            continue
        for key in ('dataframe', 'dataframe_payload', 'payload'):
            value = item.get(key)
            if isinstance(value, DataFramePayload):
                return value
        if isinstance(item.get('_df'), pd.DataFrame):
            dataframe_meta = dict(item.get('dataframe_meta') or {})
            extra_meta = {k: v for k, v in dataframe_meta.items() if k not in {'id_column', 'rows', 'columns', 'active_columns', 'source_columns'}}
            legacy_source = item.get('_source_df') if isinstance(item.get('_source_df'), pd.DataFrame) else item['_df']
            lineage = item.get('_lineage')
            if not isinstance(lineage, DataFrameLineage):
                lineage = DataFrameLineage.from_frame(legacy_source, item.get('_source_columns') or dataframe_meta.get('source_columns'))
            row_keys = item.get('_row_keys')
            if row_keys is None:
                row_keys = item['_df'].attrs.get('_iota_row_keys')
            return DataFramePayload(
                df=item['_df'],
                id_column=item.get('_id_column') or dataframe_meta.get('id_column'),
                meta=extra_meta,
                active_columns=item['_active_columns'] if '_active_columns' in item else dataframe_meta.get('active_columns'),
                source_columns=item['_source_columns'] if '_source_columns' in item else dataframe_meta.get('source_columns'),
                lineage=lineage,
                row_keys=row_keys,
            )
        if isinstance(item.get('dataframe'), pd.DataFrame):
            dataframe_meta = dict(item.get('dataframe_meta') or {})
            extra_meta = {k: v for k, v in dataframe_meta.items() if k not in {'id_column', 'rows', 'columns', 'active_columns', 'source_columns'}}
            row_keys = item.get('_row_keys')
            if row_keys is None:
                row_keys = item['dataframe'].attrs.get('_iota_row_keys')
            return DataFramePayload(
                df=item['dataframe'],
                id_column=item.get('_id_column') or dataframe_meta.get('id_column'),
                meta=extra_meta,
                active_columns=item['_active_columns'] if '_active_columns' in item else dataframe_meta.get('active_columns'),
                source_columns=item['_source_columns'] if '_source_columns' in item else dataframe_meta.get('source_columns'),
                row_keys=row_keys,
            )
    return None


def dataframe_result(
    df: pd.DataFrame,
    id_column: str | None = None,
    meta: dict[str, Any] | None = None,
    *,
    active_columns: list[str] | None = None,
    source_columns: list[str] | None = None,
    source_df: pd.DataFrame | None = None,
    source_ref: str | Path | None = None,
    lineage: DataFrameLineage | None = None,
    row_keys: pd.Index | list[int] | None = None,
    reset_lineage: bool = False,
    **extra: Any,
) -> dict[str, Any]:
    payload = DataFramePayload(
        df=df,
        id_column=id_column,
        meta=meta or {},
        active_columns=active_columns,
        source_columns=source_columns,
        lineage=lineage or (
            DataFrameLineage.from_frame(source_df, source_columns, source_ref=source_ref)
            if source_df is not None
            else DataFrameLineage.from_frame(df, source_columns, source_ref=source_ref)
            if source_ref is not None
            else None
        ),
        row_keys=pd.Index(row_keys, copy=False) if row_keys is not None else None,
    )
    result = {
        'dataframe': payload,
        'dataframe_meta': payload.public_meta(),
        '_df': payload.df,
        '_id_column': payload.id_column,
        '_active_columns': list(payload.active_columns or []),
        '_source_columns': list(payload.source_columns or []),
        '_lineage': payload.lineage,
        '_row_keys': payload.row_keys,
        '_reset_lineage': bool(reset_lineage),
    }
    result.update(extra)
    return result


def _aligned_row_keys(upstream: DataFramePayload, result_df: pd.DataFrame) -> pd.Index | None:
    """Map result rows to source positions without length-based guessing."""
    id_column = upstream.id_column
    if id_column and id_column in upstream.df.columns:
        if id_column not in result_df.columns:
            return None
        upstream_ids = upstream.df[id_column]
        result_ids = result_df[id_column]
        if upstream_ids.notna().all() and upstream_ids.is_unique and result_ids.notna().all():
            mapping = pd.Series(upstream.row_keys.to_numpy(copy=False), index=upstream_ids.to_numpy(copy=False))
            if result_ids.isin(mapping.index).all():
                return pd.Index(mapping.loc[result_ids.to_numpy(copy=False)].to_numpy(copy=False), copy=False)
    if result_df.index.equals(upstream.df.index):
        return upstream.row_keys
    if (
        result_df.index.is_unique
        and upstream.df.index.is_unique
        and result_df.index.isin(upstream.df.index).all()
    ):
        mapping = pd.Series(upstream.row_keys.to_numpy(copy=False), index=upstream.df.index)
        return pd.Index(mapping.loc[result_df.index].to_numpy(copy=False), copy=False)
    return None


def inherit_dataframe_contract(payload: DataFramePayload, upstream: DataFramePayload | None) -> DataFramePayload:
    """Attach inherited ID/source lineage to a node dataframe result.

    Nodes only need to return their transformed dataframe. This function keeps
    the workflow-level ID contract consistent for both old and new nodes.
    """
    if upstream is None:
        return payload
    if payload.id_column and upstream.id_column and payload.id_column != upstream.id_column:
        return payload

    row_keys = _aligned_row_keys(upstream, payload.df)
    if row_keys is None:
        return payload

    id_column = payload.id_column
    if not id_column and upstream.id_column and upstream.id_column in upstream.lineage.source_columns:
        id_column = upstream.id_column

    active_columns = [str(c) for c in payload.active_columns or payload.df.columns if str(c) != id_column]
    active_columns = [c for c in active_columns if c != id_column and c in payload.df.columns]
    source_columns = list(dict.fromkeys([
        *(upstream.source_columns or []),
        *(payload.source_columns or []),
    ]))
    return DataFramePayload(
        df=payload.df,
        id_column=id_column,
        meta={**dict(upstream.meta or {}), **dict(payload.meta or {})},
        active_columns=active_columns,
        source_columns=source_columns,
        lineage=upstream.lineage,
        row_keys=row_keys,
    )


def apply_dataframe_contract(result: Any, inputs: dict[str, Any]) -> Any:
    """Normalize dataframe results and inherit the upstream ID contract."""
    if not isinstance(result, dict):
        return result

    if result.get('_dataframe_contract_version') == DATAFRAME_CONTRACT_VERSION:
        return result
    upstream = dataframe_payload(inputs)
    normalized_by_identity: dict[int, Any] = {}

    def normalize(value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        identity = id(value)
        if identity in normalized_by_identity:
            return normalized_by_identity[identity]
        if value.get('_dataframe_contract_version') == DATAFRAME_CONTRACT_VERSION:
            normalized_by_identity[identity] = value
            return value
        normalized_by_identity[identity] = value
        payload = dataframe_payload({'value': value})
        if payload:
            if upstream is not None and not bool(value.get('_reset_lineage')):
                payload = inherit_dataframe_contract(payload, upstream)
            value['dataframe'] = payload
            value['dataframe_meta'] = payload.public_meta()
            value['_df'] = payload.df
            value['_id_column'] = payload.id_column
            value['_active_columns'] = list(payload.active_columns or [])
            value['_source_columns'] = list(payload.source_columns or [])
            value['_lineage'] = payload.lineage
            value['_row_keys'] = payload.row_keys
        by_port = value.get('outputs_by_port')
        if isinstance(by_port, dict):
            value['outputs_by_port'] = {key: normalize(port_value) for key, port_value in by_port.items()}
        value['_dataframe_contract_version'] = DATAFRAME_CONTRACT_VERSION
        return value

    return normalize(result)


def first_upstream_df(inputs: dict[str, Any], port_id: str | None = None) -> pd.DataFrame | None:
    """Borrow the active upstream frame.

    Call ``ensure_df`` before mutation. Read-only nodes can use the shared frame
    directly and avoid the former copy-then-copy-again path.
    """
    payload = dataframe_payload(inputs, port_id)
    return payload.df if payload else None


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


def calculation_columns(df: pd.DataFrame) -> list[str]:
    id_column = str(df.attrs.get('_iota_id_column') or '')
    raw_active = df.attrs.get('_iota_active_columns')
    active_columns = [str(c) for c in (list(df.columns) if raw_active is None else raw_active)]
    return [c for c in dict.fromkeys(active_columns) if c in df.columns and c != id_column]


def calculation_df(df: pd.DataFrame) -> pd.DataFrame:
    return df.loc[:, calculation_columns(df)].copy()


def numeric_df(df: pd.DataFrame) -> pd.DataFrame:
    converted = calculation_df(df)
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
    allowed = set(calculation_columns(df))

    def valid(values: list[Any]) -> list[str]:
        return [str(c) for c in values if str(c) in allowed]

    for key in ('columns', 'selected_columns', 'feature_columns', 'column_names'):
        value = settings.get(key)
        if isinstance(value, list):
            return valid(value)
        if isinstance(value, str) and value.strip():
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return valid(parsed)
            except Exception:
                pass
            return [c.strip() for c in value.split(',') if c.strip() in allowed]
    single = settings.get('column')
    return [str(single)] if single and str(single) in allowed else []



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

def read_dataset_path(dataset_path: str | Path) -> pd.DataFrame:
    path = Path(dataset_path)
    if not path.exists():
        raise ValueError(f'Dataset file not found: {path}')
    suffix = path.suffix.lower()
    if suffix in {'.xlsx', '.xls'}:
        return pd.read_excel(path)
    if suffix == '.tsv':
        return pd.read_csv(path, sep='\t')
    return pd.read_csv(path)


def read_dataset(dataset_id: Any) -> pd.DataFrame:
    return read_dataset_path(materialize_dataset_path(dataset_id))


def materialize_dataset_path(dataset_id: Any) -> Path:
    from app.database import SessionLocal
    from app.models import Dataset
    if not dataset_id:
        raise ValueError('Select a dataset in the workflow settings or Upload CSV/Excel node.')
    with SessionLocal() as db:
        dataset = db.get(Dataset, int(dataset_id))
        if not dataset:
            raise ValueError(f'Dataset not found: {dataset_id}')
        from app.domains.datasets.service import materialize_dataset
        path = materialize_dataset(db, dataset)
    return Path(path)


def run_file_path(context: Any, node_id: str, suffix: str) -> Path:
    run_path = context.run_path or Path(tempfile.gettempdir())
    run_path.mkdir(parents=True, exist_ok=True)
    return run_path / f'{node_id}.{suffix.lstrip(".")}'
