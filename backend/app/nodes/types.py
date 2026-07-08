from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd


@dataclass
class DataFramePayload:
    """A dataframe plus workflow metadata carried through a dataframe port."""
    df: pd.DataFrame
    id_column: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def columns(self) -> list[str]:
        return [str(c) for c in self.df.columns]

    def copy(self) -> 'DataFramePayload':
        return DataFramePayload(
            df=self.df.copy(),
            id_column=self.id_column,
            meta=dict(self.meta or {}),
        )

    def with_df(self, df: pd.DataFrame, **meta: Any) -> 'DataFramePayload':
        next_meta = dict(self.meta or {})
        next_meta.update({k: v for k, v in meta.items() if v is not None})
        return DataFramePayload(df=df, id_column=self.id_column, meta=next_meta)

    def public_meta(self) -> dict[str, Any]:
        return {
            'id_column': self.id_column,
            'rows': int(len(self.df)),
            'columns': [str(c) for c in self.df.columns],
            **dict(self.meta or {}),
        }


@dataclass
class JsonPayload:
    data: Any
    schema: dict[str, Any] | None = None
    source_node: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class ModelPayload:
    model: Any
    features: list[str] = field(default_factory=list)
    target: str | None = None
    metrics: dict[str, Any] = field(default_factory=dict)
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class PlotPayload:
    kind: str
    spec: dict[str, Any]
    source_node: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class FilePayload:
    path: Path | str
    name: str | None = None
    mime_type: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)
