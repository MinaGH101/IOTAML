from __future__ import annotations

import json
from typing import Any

import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import dendrogram, linkage
from scipy.spatial.distance import pdist
from sklearn.preprocessing import StandardScaler

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import (
    coerce_numeric_series,
    dataframe_payload,
    ensure_df,
    first_upstream_df,
    node_label,
    output,
    selected_columns,
)

SUPPORTED_METHODS = ('ward', 'average', 'complete', 'median', 'centroid')
SUPPORTED_METRICS = ('euclidean', 'correlation', 'cosine')
EUCLIDEAN_ONLY_METHODS = frozenset({'ward', 'median', 'centroid'})
MAX_CLUSTERED_OBJECTS = 2000


def _list_setting(value: Any, default: list[str]) -> list[str]:
    if isinstance(value, list):
        values = value
    elif isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            parsed = None
        values = parsed if isinstance(parsed, list) else value.split(',')
    else:
        values = []
    normalized = list(dict.fromkeys(str(item).strip().lower() for item in values if str(item).strip()))
    return normalized or default


def _boolean_setting(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() not in {'false', '0', 'no', 'off', ''}
    return bool(value)


def _unique_labels(values: list[Any]) -> list[str]:
    counts: dict[str, int] = {}
    labels: list[str] = []
    for index, value in enumerate(values):
        label = str(value).strip()
        if not label or label.lower() == 'nan':
            label = f'Row {index + 1}'
        counts[label] = counts.get(label, 0) + 1
        labels.append(label if counts[label] == 1 else f'{label} ({counts[label]})')
    return labels


def _numeric_frame(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    numeric = pd.DataFrame(
        {column: coerce_numeric_series(df, column) for column in columns},
        index=df.index,
    )
    return numeric.replace([np.inf, -np.inf], np.nan)


def _validate_method_metric(methods: list[str], metric: str) -> None:
    unsupported = [method for method in methods if method not in SUPPORTED_METHODS]
    if unsupported:
        raise ValueError(f'Unsupported clustering methods: {", ".join(unsupported)}.')
    if metric not in SUPPORTED_METRICS:
        raise ValueError(f'Unsupported distance metric: {metric}.')
    incompatible = [method for method in methods if method in EUCLIDEAN_ONLY_METHODS and metric != 'euclidean']
    if incompatible:
        raise ValueError(f'{", ".join(incompatible)} clustering requires the euclidean distance metric.')


def _plot_payload(
    *,
    node_id: str,
    title: str,
    objects: np.ndarray,
    labels: list[str],
    method: str,
    metric: str,
    cluster_target: str,
    columns: list[str],
    scaled: bool,
    rows_used: int,
    rows_dropped: int,
    removed_columns: list[str],
) -> dict[str, Any]:
    distances = pdist(objects, metric=metric)
    if distances.size == 0:
        raise ValueError('At least two valid objects are required for clustering.')
    if not np.all(np.isfinite(distances)):
        raise ValueError(
            'The distance matrix contains invalid values. Check constant values or select another metric.'
        )

    matrix = linkage(
        distances,
        method=method,
        optimal_ordering=len(labels) <= 500,
    )
    maximum_distance = float(matrix[-1, 2]) if len(matrix) else 0.0
    diagram = dendrogram(
        matrix,
        labels=labels,
        no_plot=True,
        color_threshold=maximum_distance * 0.7,
        above_threshold_color='C0',
    )
    segments = [
        {
            'color_key': str(color_key),
            'points': [
                {'x': float(distance), 'y': float(leaf_position)}
                for leaf_position, distance in zip(leaf_coordinates, distance_coordinates, strict=True)
            ],
        }
        for leaf_coordinates, distance_coordinates, color_key in zip(
            diagram['icoord'],
            diagram['dcoord'],
            diagram['color_list'],
            strict=True,
        )
    ]
    ordered_labels = [
        {'label': str(label), 'position': float(5 + index * 10)}
        for index, label in enumerate(diagram['ivl'])
    ]

    # Only the display geometry is returned. The linkage matrix and leaf order
    # are intentionally omitted because they duplicate the same information
    # and previously inflated every stored run and board snapshot.
    return output(
        node_id,
        title,
        'dendrogram',
        orientation='horizontal',
        labels_position='left',
        root_position='right',
        cluster_target=cluster_target,
        method=method,
        metric=metric,
        scaled=scaled,
        selected_columns=columns,
        rows_used=rows_used,
        rows_dropped=rows_dropped,
        removed_columns=removed_columns,
        maximum_distance=maximum_distance,
        labels=ordered_labels,
        segments=segments,
    )


class ClusteringPlotNode(BaseNode):
    id = 'VZ-007'
    name = 'Clustering Plot'
    category = 'Visualizations'
    description = 'Creates horizontal hierarchical-clustering dendrograms for dataframe columns or rows.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('plot', 'Clustering Dendrogram', 'plot')]
    settings_schema = [
        setting(
            'cluster_target',
            'Clustering Target',
            'select',
            'columns',
            options=['columns', 'rows'],
            supports_dynamic=False,
            help='Cluster dataframe columns/elements or rows/samples.',
        ),
        setting(
            'columns',
            'Columns Used for Clustering',
            'columns',
            [],
            required=True,
            help='Column leaves in column mode and numeric features in row mode.',
        ),
        setting(
            'methods',
            'Clustering Methods',
            'multiselect',
            ['ward'],
            options=list(SUPPORTED_METHODS),
            supports_dynamic=False,
        ),
        setting(
            'metric',
            'Distance Metric',
            'select',
            'euclidean',
            options=list(SUPPORTED_METRICS),
            supports_dynamic=False,
        ),
        setting('scale', 'Standardize Data', 'boolean', True, supports_dynamic=False),
    ]
    cache_version = '2'

    def run(self, node, inputs, settings, context):
        df = ensure_df(first_upstream_df(inputs, 'data'), str(node['id']))
        payload = dataframe_payload(inputs, 'data')
        cluster_target = str(settings.get('cluster_target') or 'columns').strip().lower()
        if cluster_target not in {'columns', 'rows'}:
            raise ValueError('Clustering target must be columns or rows.')

        columns = selected_columns(settings, df)
        if len(columns) < 2:
            raise ValueError('Select at least two numeric columns for clustering.')

        methods = _list_setting(settings.get('methods'), ['ward'])
        metric = str(settings.get('metric') or 'euclidean').strip().lower()
        _validate_method_metric(methods, metric)
        scaled = _boolean_setting(settings.get('scale'), True)

        numeric = _numeric_frame(df, columns)
        usable_columns = [column for column in columns if numeric[column].notna().sum() >= 2]
        removed_columns = [column for column in columns if column not in usable_columns]
        numeric = numeric.loc[:, usable_columns]
        if len(usable_columns) < 2:
            raise ValueError('At least two columns must contain two or more numeric values.')

        complete_rows = numeric.notna().all(axis=1)
        working = numeric.loc[complete_rows].copy()
        if len(working) < 2:
            raise ValueError('At least two complete rows are required after removing invalid values.')

        constant_columns = [
            str(column)
            for column in working.columns
            if working[column].nunique(dropna=True) <= 1
        ]
        removed_columns.extend(constant_columns)
        valid_columns = [str(column) for column in working.columns if str(column) not in constant_columns]
        working = working.loc[:, valid_columns]
        if len(valid_columns) < 2:
            raise ValueError('At least two non-constant numeric columns are required.')

        matrix = working.to_numpy(dtype=float)
        if scaled:
            matrix = StandardScaler().fit_transform(matrix)

        if cluster_target == 'columns':
            objects = matrix.T
            labels = valid_columns
        else:
            objects = matrix
            id_column = payload.id_column if payload and payload.id_column in df.columns else None
            row_labels = (
                df.loc[complete_rows, id_column].tolist()
                if id_column
                else working.index.tolist()
            )
            labels = _unique_labels(row_labels)

        if len(labels) > MAX_CLUSTERED_OBJECTS:
            raise ValueError(
                f'Hierarchical clustering is limited to {MAX_CLUSTERED_OBJECTS} objects. '
                'Filter the dataframe or select fewer columns first.'
            )
        if len(labels) < 2:
            raise ValueError('At least two objects are required for clustering.')

        plots = [
            _plot_payload(
                node_id=str(node['id']),
                title=f'{node_label(node)} · {method.title()}',
                objects=objects,
                labels=labels,
                method=method,
                metric=metric,
                cluster_target=cluster_target,
                columns=valid_columns,
                scaled=scaled,
                rows_used=len(working),
                rows_dropped=len(df) - len(working),
                removed_columns=removed_columns,
            )
            for method in methods
        ]
        if len(plots) == 1:
            return {'_df': df, 'plot': {'type': 'dendrogram'}, 'output': plots[0]}
        return {
            '_df': df,
            'plot': {'type': 'dendrogram_group'},
            'output': output(
                str(node['id']),
                node_label(node),
                'plot_group',
                plots=plots,
                count=len(plots),
                layout='vertical',
            ),
        }
