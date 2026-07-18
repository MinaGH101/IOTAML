from __future__ import annotations

import base64
import binascii
from io import BytesIO, StringIO
from pathlib import Path
from typing import Any

import pandas as pd

MAX_INLINE_TABLE_BYTES = 2 * 1024 * 1024
_ALLOWED_SUFFIXES = {'.csv', '.tsv', '.txt', '.xlsx'}


def _decode_data_url(data_url: str) -> bytes:
    if ',' not in data_url:
        raise ValueError('Uploaded table file is malformed.')
    header, encoded = data_url.split(',', 1)
    if ';base64' not in header.lower():
        raise ValueError('Uploaded table file must use base64 encoding.')
    try:
        return base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError('Uploaded table file contains invalid base64 data.') from exc


def _read_delimited(raw: bytes, suffix: str) -> pd.DataFrame:
    text: str | None = None
    for encoding in ('utf-8-sig', 'utf-8', 'cp1252'):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise ValueError('Could not decode the uploaded delimited text file.')
    separator = '\t' if suffix == '.tsv' else None
    try:
        return pd.read_csv(StringIO(text), sep=separator, engine='python' if separator is None else 'c')
    except Exception as exc:
        raise ValueError(f'Could not parse the uploaded table: {exc}') from exc


def read_uploaded_table(value: Any, *, max_bytes: int = MAX_INLINE_TABLE_BYTES) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Read a small CSV/TSV/XLSX embedded in workflow settings.

    The frontend stores files as a compact data URL object. Plain strings remain
    supported for older CSV-only nodes and imported workflows.
    """
    if value in (None, '', {}):
        raise ValueError('A mapping table file is required.')

    name = 'mapping.csv'
    mime_type = 'text/csv'
    if isinstance(value, str):
        raw = value.encode('utf-8')
        suffix = '.csv'
    elif isinstance(value, dict):
        name = str(value.get('name') or 'mapping.csv').strip() or 'mapping.csv'
        mime_type = str(value.get('mime_type') or value.get('type') or 'application/octet-stream')
        data_url = str(value.get('data_url') or '')
        if data_url:
            raw = _decode_data_url(data_url)
        elif isinstance(value.get('text'), str):
            raw = str(value['text']).encode('utf-8')
        else:
            raise ValueError('Uploaded table file has no readable content.')
        suffix = Path(name).suffix.lower() or ('.xlsx' if 'spreadsheet' in mime_type else '.csv')
    else:
        raise ValueError('Uploaded table file has an unsupported value type.')

    if len(raw) > max_bytes:
        raise ValueError(f'Uploaded mapping table exceeds the {max_bytes // (1024 * 1024)} MB limit.')
    if suffix not in _ALLOWED_SUFFIXES:
        raise ValueError('Mapping table must be CSV, TSV, TXT, or XLSX.')

    if suffix == '.xlsx':
        try:
            frame = pd.read_excel(BytesIO(raw), engine='openpyxl')
        except Exception as exc:
            raise ValueError(f'Could not parse the uploaded XLSX mapping table: {exc}') from exc
    else:
        frame = _read_delimited(raw, suffix)

    if frame.empty:
        raise ValueError('The uploaded mapping table is empty.')
    frame.columns = [str(column).strip() for column in frame.columns]
    return frame, {'name': name, 'mime_type': mime_type, 'size_bytes': len(raw), 'columns': list(frame.columns)}
