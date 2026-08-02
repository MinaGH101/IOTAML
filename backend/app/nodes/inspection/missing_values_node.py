"""Workflow node for generating a tabular missing-values report."""

from __future__ import annotations

import pandas as pd

from app.nodes.base import BaseNode, port
from app.nodes.io import (
    calculation_columns,
    dataframe_payload,
    dataframe_result,
    ensure_df,
    node_label,
    table_output,
)


class MissingValuesReportNode(BaseNode):
    """Calculate missing-value statistics for every calculation column."""

    id = 'IN-004'
    name = 'Missing Values Report'
    category = 'Data Inspection'
    description = 'Calculates missing count and missing percent for each column.'

    inputs = [
        port('data', 'DataFrame', 'dataframe'),
    ]

    # This node now has exactly one output.
    outputs = [
        port(
            'missing_report',
            'Missing Values Report',
            'dataframe',
        ),
    ]

    def run(self, node, inputs, settings, context):
        """Create and return the missing-values report as a dataframe."""

        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(
            payload.df if payload else None,
            str(node['id']),
        )

        rows: list[dict] = []

        for column in calculation_columns(df):
            missing_count = int(df[column].isna().sum())
            missing_percent = float(df[column].isna().mean() * 100)

            rows.append(
                {
                    'column': str(column),
                    'dtype': str(df[column].dtype),
                    'missing': missing_count,
                    'missing_percent': missing_percent,
                }
            )

        # This is the actual dataframe passed through the output port.
        report_df = pd.DataFrame(
            rows,
            columns=[
                'column',
                'dtype',
                'missing',
                'missing_percent',
            ],
        )

        report_meta = {
            'source_rows_total': int(len(df)),
            'source_columns_total': int(len(df.columns)),
            'reported_columns_total': int(len(report_df)),
            'source_id_column': payload.id_column if payload else None,
        }

        # The declared output port must receive a dataframe_result contract.
        report_payload = dataframe_result(
            report_df,
            id_column=None,
            meta=report_meta,
            reset_lineage=True,
        )

        visible_table = table_output(
            str(node['id']),
            f'{node_label(node)} · Missing Values Report',
            report_df,
            max_rows=len(report_df),
        )

        result = dataframe_result(
            report_df,
            id_column=None,
            meta=report_meta,
            reset_lineage=True,
            outputs_by_port={'missing_report': report_payload},
            output=visible_table,
        )
        result['missing_report'] = {'columns': rows, 'rows_total': len(rows), 'source_id_column': payload.id_column if payload else None}
        return result