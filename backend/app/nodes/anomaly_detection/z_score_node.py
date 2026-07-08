from __future__ import annotations

import pandas as pd

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import (
    coerce_numeric_series,
    dataframe_payload,
    dataframe_result,
    ensure_df,
    node_label,
    numeric_df,
    parse_number_list,
    selected_columns,
    table_output,
)


class ZScoreOutlierNode(BaseNode):
    id = 'AD-001'
    name = 'Z-Score Outlier Detector'
    category = 'Anomaly Detection'
    description = 'Detects outliers per numeric column using one or more absolute z-score thresholds.'

    inputs = [
        port('data', 'DataFrame', 'dataframe'),
    ]

    outputs = [
        port('dataframe', 'DataFrame with flags', 'dataframe'),
        port('report', 'Outlier Report', 'json'),
    ]

    settings_schema = [
        setting('columns', 'Columns', 'columns', []),
        setting('thresholds', 'Z Thresholds', 'text', '3', help='Comma-separated thresholds. Example: 3, 2'),
        setting('max_output_rows', 'Max Output Rows', 'integer', 200),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))
        id_column = payload.id_column if payload else None
        cols = selected_columns(settings, df) or list(numeric_df(df).columns)
        thresholds = parse_number_list(settings.get('thresholds') or settings.get('threshold'), default=[3.0])
        max_rows = int(settings.get('max_output_rows') or 200)

        summary: list[dict] = []
        all_anomalies: list[dict] = []
        outputs: list[dict] = []
        output_columns = ['row_index'] + (['id_column', 'id_value'] if id_column else []) + ['column', 'value', 'z_score', 'threshold']

        z_cache: dict[str, pd.Series] = {}
        stat_cache: dict[str, tuple[float, float]] = {}

        for col in cols:
            s = coerce_numeric_series(df, col)
            mean = float(s.mean()) if not s.dropna().empty else 0.0
            std = float(s.std(ddof=0)) if not s.dropna().empty else 0.0
            z_scores = pd.Series(0.0, index=df.index) if std == 0 else (s - mean) / std
            df[f'{col}_z_score'] = z_scores
            z_cache[str(col)] = z_scores
            stat_cache[str(col)] = (mean, std)

        for threshold in thresholds:
            threshold_anomalies: list[dict] = []
            for col in cols:
                z_scores = z_cache[str(col)]
                mean, std = stat_cache[str(col)]
                flag_col = f'{col}_z_{str(threshold).replace(".", "_")}_outlier'
                flags = z_scores.abs() > threshold
                df[flag_col] = flags.fillna(False)

                indexes = df.index[df[flag_col]].tolist()
                summary.append({
                    'column': str(col),
                    'mean': round(mean, 6),
                    'std': round(std, 6),
                    'threshold': threshold,
                    'outliers': len(indexes),
                })

                for idx in indexes:
                    row = {'row_index': int(idx) if isinstance(idx, int) else str(idx)}
                    if id_column and id_column in df.columns:
                        row['id_column'] = id_column
                        row['id_value'] = None if pd.isna(df.at[idx, id_column]) else df.at[idx, id_column]
                    row.update({
                        'column': str(col),
                        'value': None if pd.isna(df.at[idx, col]) else df.at[idx, col],
                        'z_score': round(float(df.at[idx, f'{col}_z_score']), 4),
                        'threshold': threshold,
                    })
                    threshold_anomalies.append(row)
                    all_anomalies.append(row)

            out_df = pd.DataFrame(threshold_anomalies, columns=output_columns)
            preview = table_output(str(node['id']), f'{node_label(node)} · Z {threshold}', out_df.head(max_rows), max_rows)
            preview['title'] = f'Z-Score Anomalies · threshold {threshold}'
            preview['id_column'] = id_column
            preview['threshold'] = threshold
            outputs.append(preview)

        report = {
            'id_column': id_column,
            'thresholds': thresholds,
            'summary': summary,
            'anomalies': all_anomalies,
            'total_anomalies': len(all_anomalies),
        }

        return dataframe_result(
            df,
            id_column=id_column,
            meta=payload.meta if payload else {},
            report=report,
            json=report,
            output=outputs[0] if outputs else table_output(str(node['id']), node_label(node), pd.DataFrame(columns=output_columns), max_rows),
            outputs=outputs,
        )
