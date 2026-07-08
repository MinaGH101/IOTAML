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
    table_output,
)


class ThresholdAnomalyNode(BaseNode):
    id = 'AD-004'
    name = 'Threshold Anomaly Detector'
    category = 'Anomaly Detection'
    description = 'Detects anomalies for one numeric column using one or more thresholds.'

    inputs = [
        port('data', 'DataFrame', 'dataframe'),
    ]

    outputs = [
        port('dataframe', 'DataFrame with flags', 'dataframe'),
        port('report', 'Threshold Report', 'json'),
    ]

    settings_schema = [
        setting('column', 'Column', 'column', ''),
        setting('operator', 'Operator', 'select', '>', options=['>', '>=', '<', '<=', '==', '!=']),
        setting('thresholds', 'Thresholds', 'text', '0', help='Comma-separated thresholds. Example: 3, 2 or 1.5, 2.5'),
        setting('max_output_rows', 'Max Output Rows', 'integer', 200),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))
        id_column = payload.id_column if payload else None

        col = settings.get('column') or next(iter(numeric_df(df).columns), None)
        if not col or str(col) not in df.columns:
            raise ValueError('Select a numeric column for threshold anomaly detection.')
        col = str(col)

        op = str(settings.get('operator') or '>')
        thresholds = parse_number_list(settings.get('thresholds') or settings.get('threshold'), default=[0.0])
        max_rows = int(settings.get('max_output_rows') or 200)
        s = coerce_numeric_series(df, col)
        total_rows = int(len(df))

        output_columns = ['row_index'] + (['id_column', 'id_value'] if id_column else []) + ['column', 'value', 'operator', 'threshold']
        summary: list[dict] = []
        all_anomalies: list[dict] = []
        outputs: list[dict] = []

        for threshold in thresholds:
            if op == '>':
                flags = s > threshold
            elif op == '>=':
                flags = s >= threshold
            elif op == '<':
                flags = s < threshold
            elif op == '<=':
                flags = s <= threshold
            elif op == '!=':
                flags = s != threshold
            else:
                flags = s == threshold

            flag_col = f'{col}_threshold_{op.replace("=", "eq").replace(">", "gt").replace("<", "lt")}_{str(threshold).replace(".", "_")}_anomaly'
            df[flag_col] = flags.fillna(False)
            indexes = df.index[df[flag_col]].tolist()
            rows: list[dict] = []

            for idx in indexes:
                row = {'row_index': int(idx) if isinstance(idx, int) else str(idx)}
                if id_column and id_column in df.columns:
                    row['id_column'] = id_column
                    row['id_value'] = None if pd.isna(df.at[idx, id_column]) else df.at[idx, id_column]
                row.update({
                    'column': col,
                    'value': None if pd.isna(df.at[idx, col]) else df.at[idx, col],
                    'operator': op,
                    'threshold': threshold,
                })
                rows.append(row)
                all_anomalies.append(row)

            matching_rows = len(rows)
            match_percent = round((matching_rows / total_rows) * 100, 4) if total_rows else 0.0

            summary_row = {
                'matching_rows': matching_rows,
                'total_rows': total_rows,
                'match_percent': match_percent,
                'column': col,
                'operator': op,
                'threshold': threshold,
            }
            summary.append({**summary_row, 'outliers': matching_rows})

            summary_df = pd.DataFrame([summary_row], columns=[
                'matching_rows', 'total_rows', 'match_percent', 'column', 'operator', 'threshold'
            ])
            summary_preview = table_output(
                str(node['id']),
                f'{node_label(node)} · Match Count · {op} {threshold}',
                summary_df,
                1,
            )
            summary_preview['title'] = f'Matching Rows · {col} {op} {threshold}'
            summary_preview['threshold'] = threshold
            summary_preview['is_summary'] = True
            outputs.append(summary_preview)

            out_df = pd.DataFrame(rows, columns=output_columns)
            preview = table_output(
                str(node['id']),
                f'{node_label(node)} · {op} {threshold}',
                out_df.head(max_rows),
                max_rows,
            )
            preview['title'] = f'Threshold Anomalies · {col} {op} {threshold}'
            preview['id_column'] = id_column
            preview['threshold'] = threshold
            outputs.append(preview)

        report = {
            'id_column': id_column,
            'column': col,
            'operator': op,
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
