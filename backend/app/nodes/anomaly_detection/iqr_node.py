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


class IQROutlierNode(BaseNode):
    id = 'AD-003'
    name = 'IQR Outlier Detector'
    category = 'Anomaly Detection'
    description = 'Detects outliers per numeric column using one or more IQR multipliers.'

    inputs = [
        port('data', 'DataFrame', 'dataframe'),
    ]

    outputs = [
        port('dataframe', 'DataFrame with flags', 'dataframe'),
        port('report', 'Outlier Report', 'json'),
    ]

    settings_schema = [
        setting('columns', 'Columns', 'columns', []),
        setting('iqr_multipliers', 'IQR Multipliers', 'text', '1.5', help='Comma-separated multipliers. Example: 1.5, 2.5'),
        setting('max_output_rows', 'Max Output Rows', 'integer', 200),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))
        id_column = payload.id_column if payload else None
        cols = selected_columns(settings, df) or list(numeric_df(df).columns)
        raw_multipliers = settings.get('iqr_multipliers') or settings.get('iqr_multiplier') or '1.5'
        multipliers = parse_number_list(raw_multipliers, default=[1.5])
        max_rows = int(settings.get('max_output_rows') or 200)

        summary: list[dict] = []
        all_anomalies: list[dict] = []
        outputs: list[dict] = []

        output_columns = ['row_index'] + (['id'] if id_column else []) + [
            'column', 'value', 'iqr_multiplier', 'lower_bound', 'upper_bound', 'iqr'
        ]

        for multiplier in multipliers:
            multiplier_anomalies: list[dict] = []

            for col in cols:
                s = coerce_numeric_series(df, col)
                q1 = float(s.quantile(0.25)) if not s.dropna().empty else 0.0
                q3 = float(s.quantile(0.75)) if not s.dropna().empty else 0.0
                iqr = q3 - q1
                lower = q1 - multiplier * iqr
                upper = q3 + multiplier * iqr

                flag_col = f'{col}_iqr_{str(multiplier).replace(".", "_")}_outlier'
                flags = (s < lower) | (s > upper)
                df[flag_col] = flags.fillna(False)

                indexes = df.index[df[flag_col]].tolist()
                summary.append({
                    'column': str(col),
                    'iqr_multiplier': multiplier,
                    'q1': round(q1, 6),
                    'q3': round(q3, 6),
                    'iqr': round(float(iqr), 6),
                    'lower_bound': round(float(lower), 6),
                    'upper_bound': round(float(upper), 6),
                    'outliers': len(indexes),
                })

                for idx in indexes:
                    row = {'row_index': int(idx) if isinstance(idx, int) else str(idx)}
                    if id_column and id_column in df.columns:
                        row['id'] = None if pd.isna(df.at[idx, id_column]) else df.at[idx, id_column]
                    row.update({
                        'column': str(col),
                        'value': None if pd.isna(df.at[idx, col]) else df.at[idx, col],
                        'iqr_multiplier': multiplier,
                        'lower_bound': round(float(lower), 6),
                        'upper_bound': round(float(upper), 6),
                        'iqr': round(float(iqr), 6),
                    })
                    multiplier_anomalies.append(row)
                    all_anomalies.append(row)

            out_df = pd.DataFrame(multiplier_anomalies, columns=output_columns)
            preview = table_output(
                str(node['id']),
                f'{node_label(node)} · IQR {multiplier}',
                out_df.head(max_rows),
                max_rows,
            )
            preview['title'] = f'IQR Anomalies · multiplier {multiplier}'
            preview['id_column'] = id_column
            preview['iqr_multiplier'] = multiplier
            outputs.append(preview)

        report = {
            'id_column': id_column,
            'multipliers': multipliers,
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
