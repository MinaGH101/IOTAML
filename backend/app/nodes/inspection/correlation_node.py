from __future__ import annotations

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, dataframe_result, ensure_df, node_label, numeric_df, output, selected_columns, table_output


class CorrelationMatrixNode(BaseNode):
    id = 'IN-006'
    name = 'Correlation Matrix'
    category = 'Data Inspection'
    description = 'Calculates a correlation matrix for selected numeric columns.'

    inputs = [
        port('data', 'DataFrame', 'dataframe'),
    ]

    outputs = [
        port('dataframe', 'DataFrame', 'dataframe'),
        port('matrix', 'Correlation Matrix', 'json'),
    ]

    settings_schema = [
        setting('columns', 'Columns', 'columns', []),
        setting('method', 'Method', 'select', 'pearson', options=['pearson', 'spearman', 'kendall']),
        setting('max_plot_columns', 'Max Plot Columns', 'integer', 18, help='Limits the heatmap only. The table still contains the selected columns.'),
    ]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.df if payload else None, str(node['id']))

        selected = selected_columns(settings, df)
        num = numeric_df(df)
        if selected:
            num = num[[c for c in selected if c in num.columns]]

        if num.empty or len(num.columns) < 2:
            raise ValueError('Correlation Matrix requires at least two numeric columns.')

        method = str(settings.get('method') or 'pearson')
        corr = num.corr(method=method)
        labels = [str(c) for c in corr.columns]

        table_df = corr.reset_index().rename(columns={'index': 'column'})
        table_df.columns = [str(c) for c in table_df.columns]

        max_plot_columns = max(2, int(settings.get('max_plot_columns') or 18))
        plot_corr = corr.iloc[:max_plot_columns, :max_plot_columns]
        plot_labels = [str(c) for c in plot_corr.columns]

        matrix_output = output(
            str(node['id']),
            f'{node_label(node)} · heatmap',
            'heatmap',
            labels=plot_labels,
            matrix=plot_corr.values.tolist(),
            method=method,
            columns_total=len(labels),
            plotted_columns=len(plot_labels),
        )

        table_preview = table_output(
            str(node['id']),
            f'{node_label(node)} · correlation table',
            table_df,
            500,
        )
        table_preview['method'] = method

        report = {
            'method': method,
            'columns': labels,
            'matrix': corr.to_dict(),
            'table': table_df.to_dict(orient='records'),
        }

        return dataframe_result(
            df,
            id_column=payload.id_column if payload else None,
            meta=payload.meta if payload else {},
            matrix=report,
            json=report,
            output=matrix_output,
            outputs=[matrix_output, table_preview],
        )
