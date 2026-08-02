"""Workflow node for generating a correlation table and heatmap."""

from __future__ import annotations

from app.nodes.base import BaseNode, port, setting
from app.nodes.io import (
    dataframe_payload,
    dataframe_result,
    ensure_df,
    node_label,
    numeric_df,
    output,
    selected_columns,
    table_output,
)


class CorrelationMatrixNode(BaseNode):
    """Calculate correlations and expose them as a table and heatmap."""

    id = 'IN-006'
    name = 'Correlation Matrix'
    category = 'Data Inspection'
    description = (
        'Calculates a correlation matrix for selected numeric columns '
        'and returns a table and heatmap.'
    )

    inputs = [
        port('data', 'DataFrame', 'dataframe'),
    ]

    # The original input dataframe is intentionally not returned.
    outputs = [
        port(
            'matrix',
            'Correlation Matrix Table',
            'dataframe',
        ),
        port(
            'heatmap',
            'Correlation Heatmap',
            'plot',
        ),
    ]

    settings_schema = [
        setting(
            'columns',
            'Columns',
            'columns',
            [],
        ),
        setting(
            'method',
            'Method',
            'select',
            'pearson',
            options=[
                'pearson',
                'spearman',
                'kendall',
            ],
        ),
        setting(
            'max_plot_columns',
            'Max Plot Columns',
            'integer',
            18,
            help=(
                'Limits only the number of columns displayed in the heatmap. '
                'The table contains all selected numeric columns.'
            ),
        ),
    ]

    def run(self, node, inputs, settings, context):
        """Create the correlation dataframe and heatmap output contracts."""

        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(
            payload.df if payload else None,
            str(node['id']),
        )

        # Keep only numeric dataframe columns.
        numeric = numeric_df(df)

        requested_columns = selected_columns(settings, df)

        if requested_columns:
            valid_columns = [
                column
                for column in requested_columns
                if column in numeric.columns
            ]

            invalid_columns = [
                str(column)
                for column in requested_columns
                if column not in numeric.columns
            ]

            if invalid_columns:
                raise ValueError(
                    'Correlation Matrix received nonnumeric or missing columns: '
                    + ', '.join(invalid_columns)
                    + '. Select only numeric columns that exist in the input dataframe.'
                )

            numeric = numeric[valid_columns]

        if numeric.empty:
            raise ValueError(
                'Correlation Matrix did not receive any usable numeric columns.'
            )

        if len(numeric.columns) < 2:
            raise ValueError(
                'Correlation Matrix requires at least two numeric columns.'
            )

        method = str(settings.get('method') or 'pearson').lower()

        if method not in {'pearson', 'spearman', 'kendall'}:
            raise ValueError(
                f"Unsupported correlation method '{method}'. "
                'Use pearson, spearman, or kendall.'
            )

        # Calculate the complete correlation matrix.
        correlation = numeric.corr(method=method)

        correlation_labels = [
            str(column)
            for column in correlation.columns
        ]

        # Convert the matrix into a dataframe suitable for table rendering.
        table_df = correlation.reset_index()
        table_df = table_df.rename(
            columns={
                table_df.columns[0]: 'column',
            }
        )
        table_df.columns = [
            str(column)
            for column in table_df.columns
        ]

        # The table port carries a real dataframe contract.
        matrix_payload = dataframe_result(
            table_df,
            id_column='column',
            meta={
                'correlation_method': method,
                'correlation_columns': correlation_labels,
                'columns_total': len(correlation_labels),
            },
            reset_lineage=True,
        )

        table_preview = table_output(
            str(node['id']),
            f'{node_label(node)} · Correlation Matrix',
            table_df,
            max_rows=len(table_df),
        )
        table_preview.update(
            {
                'method': method,
                'source_handle': 'matrix',
                'source_port_name': 'Correlation Matrix Table',
            }
        )

        # Limit only the heatmap. The table above remains complete.
        max_plot_columns = max(
            2,
            int(settings.get('max_plot_columns') or 18),
        )

        plot_correlation = correlation.iloc[
            :max_plot_columns,
            :max_plot_columns,
        ]

        plot_labels = [
            str(column)
            for column in plot_correlation.columns
        ]

        heatmap_output = output(
            str(node['id']),
            f'{node_label(node)} · Correlation Heatmap',
            'heatmap',
            labels=plot_labels,
            x_labels=plot_labels,
            y_labels=plot_labels,
            matrix=plot_correlation.values.tolist(),
            method=method,
            columns_total=len(correlation_labels),
            plotted_columns=len(plot_labels),
            source_handle='heatmap',
            source_port_name='Correlation Heatmap',
        )

        return {
            # Direct port values.
            'matrix': matrix_payload,
            'heatmap': heatmap_output,

            # Authoritative values used when connecting output ports.
            'outputs_by_port': {
                'matrix': matrix_payload,
                'heatmap': heatmap_output,
            },

            # Visible outputs shown in the workspace.
            'output': table_preview,
            'outputs': [
                heatmap_output,
                table_preview,
            ],
        }