from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd


@dataclass(frozen=True)
class DataFrameLineage:
    """Immutable, shared source columns for one dataframe lineage.

    A lineage object is shared by downstream payloads.  Nodes receive copies of
    the active dataframe, so the source frame is never mutated during normal
    execution and is not duplicated for every in-memory node result.
    """

    source_columns: tuple[str, ...]
    _source_df: pd.DataFrame | None = field(default=None, repr=False)
    source_ref: str | None = None

    @classmethod
    def from_frame(
        cls,
        frame: pd.DataFrame,
        source_columns: list[str] | tuple[str, ...] | None = None,
        source_ref: str | Path | None = None,
    ) -> "DataFrameLineage":
        columns = tuple(dict.fromkeys(str(column) for column in (source_columns or frame.columns)))
        return cls(_source_df=frame, source_columns=columns, source_ref=str(source_ref) if source_ref else None)

    @property
    def source_df(self) -> pd.DataFrame:
        frame = self._source_df
        if frame is None:
            if not self.source_ref:
                raise ValueError("Dataframe source lineage is unavailable.")
            path = Path(self.source_ref)
            if not path.is_file():
                raise ValueError(f"Dataframe source artifact is unavailable: {path}")
            suffix = path.suffix.lower()
            if suffix in {".xlsx", ".xls"}:
                frame = pd.read_excel(path)
            elif suffix == ".tsv":
                frame = pd.read_csv(path, sep="\t")
            else:
                frame = pd.read_csv(path)
            object.__setattr__(self, "_source_df", frame)
        return frame

    def __getstate__(self) -> dict[str, Any]:
        """Keep persistent cache entries lightweight for artifact-backed data."""
        return {
            "_source_df": None if self.source_ref else self._source_df,
            "source_columns": self.source_columns,
            "source_ref": self.source_ref,
        }

    def __setstate__(self, state: dict[str, Any]) -> None:
        object.__setattr__(self, "_source_df", state.get("_source_df"))
        object.__setattr__(self, "source_columns", tuple(state.get("source_columns") or ()))
        object.__setattr__(self, "source_ref", state.get("source_ref"))


@dataclass
class DataFramePayload:
    """A dataframe plus workflow metadata carried through a dataframe port.

    ``df`` contains only the selected ID and active calculation columns.
    ``lineage`` points to one shared immutable source frame, while ``row_keys``
    explicitly maps current rows to source positions.  This keeps ID switching
    possible without embedding a copied source dataframe in every result.
    """

    df: pd.DataFrame
    id_column: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)
    active_columns: list[str] | None = None
    source_columns: list[str] | None = None
    lineage: DataFrameLineage | None = field(default=None, repr=False)
    row_keys: pd.Index | None = field(default=None, repr=False)

    def __post_init__(self) -> None:
        self.id_column = str(self.id_column).strip() if self.id_column not in [None, ''] else None
        if self.lineage is None:
            self.lineage = DataFrameLineage.from_frame(self.df, self.source_columns)
        ordered_source = [
            *[str(column) for column in (self.source_columns or self.lineage.source_columns)],
            *[str(column) for column in self.lineage.source_columns],
        ]
        self.source_columns = list(dict.fromkeys(ordered_source))
        if self.row_keys is None:
            self.row_keys = pd.RangeIndex(len(self.df))
        else:
            self.row_keys = pd.Index(self.row_keys, copy=False)
        if len(self.row_keys) != len(self.df):
            raise ValueError("Dataframe row lineage does not match the dataframe length.")
        if self.lineage._source_df is not None and len(self.lineage._source_df) and len(self.row_keys):
            positions = self.row_keys.to_numpy(dtype="int64", copy=False)
            if positions.min() < 0 or positions.max() >= len(self.lineage._source_df):
                raise ValueError("Dataframe row lineage points outside the source frame.")

        if self.active_columns is None:
            active = [str(c) for c in self.df.columns if str(c) != self.id_column]
        else:
            active = [str(c) for c in self.active_columns]
        self.active_columns = [
            column
            for column in dict.fromkeys(active)
            if column != self.id_column and column in self.df.columns
        ]

        self.df = self._materialize(self.id_column, self.active_columns)
        self._apply_attrs()

    @property
    def columns(self) -> list[str]:
        return [str(c) for c in self.df.columns]

    @property
    def id_options(self) -> list[str]:
        available = set(self.lineage.source_columns)
        return [c for c in self.source_columns or [] if c in available]

    @property
    def calculation_columns(self) -> list[str]:
        return [c for c in self.active_columns or [] if c in self.df.columns and c != self.id_column]

    def _materialize(self, id_column: str | None, active_columns: list[str]) -> pd.DataFrame:
        result = self.df
        if id_column and id_column not in result.columns and id_column in self.lineage.source_df.columns:
            result = result.copy()
            values = self.lineage.source_df.iloc[self.row_keys][id_column].to_numpy(copy=False)
            result.insert(0, id_column, values)
        requested = [column for column in active_columns if column in result.columns]
        if id_column and id_column in result.columns:
            requested = [id_column, *[c for c in requested if c != id_column]]
        requested = list(dict.fromkeys(requested))
        if requested == [str(column) for column in result.columns]:
            return result
        return result.loc[:, requested].copy()

    def _apply_attrs(self) -> None:
        attrs = dict(self.df.attrs or {})
        attrs['_iota_id_column'] = self.id_column
        attrs['_iota_active_columns'] = list(self.active_columns or [])
        attrs['_iota_source_columns'] = list(self.source_columns or [])
        self.df.attrs = attrs

    def copy(self) -> 'DataFramePayload':
        """Return a cheap payload view sharing immutable dataframe storage."""
        return DataFramePayload(
            df=self.df,
            id_column=self.id_column,
            meta=dict(self.meta or {}),
            active_columns=list(self.active_columns or []),
            source_columns=list(self.source_columns or []),
            lineage=self.lineage,
            row_keys=self.row_keys,
        )

    def with_df(
        self,
        df: pd.DataFrame,
        *,
        row_keys: pd.Index | list[int] | None = None,
        **meta: Any,
    ) -> 'DataFramePayload':
        next_meta = dict(self.meta or {})
        next_meta.update({k: v for k, v in meta.items() if v is not None})
        return DataFramePayload(
            df=df,
            id_column=self.id_column,
            meta=next_meta,
            active_columns=[c for c in self.active_columns or [] if c in df.columns],
            source_columns=list(self.source_columns or []),
            lineage=self.lineage,
            row_keys=pd.Index(row_keys, copy=False) if row_keys is not None else self.row_keys,
        )

    def with_id_column(self, id_column: str | None) -> 'DataFramePayload':
        next_id = str(id_column).strip() if id_column not in [None, ''] else None
        if next_id and next_id not in self.lineage.source_columns:
            raise ValueError(f'ID column not found: {next_id}')
        active = [c for c in self.active_columns or [] if c != next_id]
        return DataFramePayload(
            df=self.df,
            id_column=next_id,
            meta=dict(self.meta or {}),
            active_columns=active,
            source_columns=list(self.source_columns or []),
            lineage=self.lineage,
            row_keys=self.row_keys,
        )

    def frame_for_id(self, id_column: str | None = None) -> pd.DataFrame:
        """Return active columns with the requested ID first."""
        return self.with_id_column(id_column if id_column not in [None, ''] else self.id_column).df

    def export_df(self) -> pd.DataFrame:
        """Return the user-facing dataframe with ID first and hidden columns excluded."""
        return self.df.copy()

    def source_frame(self) -> pd.DataFrame:
        """Materialize source columns for only the current rows."""
        return self.lineage.source_df.iloc[self.row_keys].set_axis(self.df.index).copy()

    def public_meta(self) -> dict[str, Any]:
        return {
            **dict(self.meta or {}),
            'id_column': self.id_column,
            'rows': int(len(self.df)),
            'columns': [str(c) for c in self.df.columns],
            'active_columns': list(self.active_columns or []),
            'source_columns': list(self.source_columns or []),
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
