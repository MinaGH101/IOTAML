from __future__ import annotations

from app.nodes.base import BaseNode, port
from app.nodes.io import dataframe_payload, dataframe_result, ensure_df, node_label, output


class MissingValuesReportNode(BaseNode):
    id = 'IN-004'
    name = 'Missing Values Report'
    category = 'Data Inspection'
    description = 'Calculates missing count and missing percent for each column.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'DataFrame', 'dataframe'), port('missing_report', 'Missing Report', 'json')]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))
        rows = []
        for c in df.columns:
            pct = float(df[c].isna().mean() * 100)
            rows.append({
                'column': str(c),
                'column_name': str(c),
                'dtype': str(df[c].dtype),
                'missing': int(df[c].isna().sum()),
                'missing_pct': pct,
                'missing_percent': pct,
            })
        report = {
            'columns': rows,
            'rows_total': len(df),
            'columns_total': len(df.columns),
            'id_column': payload.id_column if payload else None,
        }
        return dataframe_result(
            df,
            id_column=payload.id_column if payload else None,
            meta=payload.meta if payload else {},
            missing_report=report,
            json=report,
            output=output(str(node['id']), node_label(node), 'table', rows=rows, columns=['column', 'dtype', 'missing', 'missing_percent'], rows_total=len(rows), columns_total=4),
        )
