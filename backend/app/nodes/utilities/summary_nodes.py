"""Small, bounded dataframe tools for common business workflows."""
from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, dataframe_result, ensure_df, selected_columns


class RemoveDuplicatesNode(BaseNode):
    id = 'CL-012'
    name = 'Remove Duplicate Rows'
    category = 'Data Cleaning'
    description = 'Remove repeated rows using selected input columns, preserving original row order.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'Unique Rows', 'dataframe')]
    settings_schema = [setting('columns', 'Compare Columns', 'columns', []), setting('keep', 'Keep', 'select', 'first', options=['first', 'last', 'none'])]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        frame = ensure_df(payload.df if payload else None, str(node['id']))
        columns = selected_columns(settings, frame) or payload.calculation_columns
        keep = settings.get('keep', 'first')
        if keep not in {'first', 'last', 'none'} or not columns:
            raise ValueError('Choose valid comparison columns and keep mode.')
        result = frame.drop_duplicates(subset=columns, keep=False if keep == 'none' else keep)
        return dataframe_result(result, id_column=payload.id_column, meta=dict(payload.meta))


class GroupSummaryNode(BaseNode):
    id = 'TR-022'
    name = 'Group Summary'
    category = 'Transformation'
    description = 'Summarize numeric columns by category, batch, supplier or another connected column.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('dataframe', 'Grouped Data', 'dataframe')]
    settings_schema = [setting('group_by', 'Group By', 'column', '', required=True), setting('columns', 'Value Columns', 'columns', [], required=True),
                       setting('operation', 'Aggregation', 'select', 'mean', options=['mean', 'sum', 'min', 'max', 'count', 'median'])]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        frame = ensure_df(payload.df if payload else None, str(node['id']))
        group = str(settings.get('group_by', ''))
        columns = [c for c in selected_columns(settings, frame) if c != group]
        operation = settings.get('operation', 'mean')
        if group not in frame.columns or not columns or operation not in {'mean', 'sum', 'min', 'max', 'count', 'median'}:
            raise ValueError('Choose a group, value columns and aggregation from the connected input.')
        result = frame.groupby(group, dropna=False, sort=False, observed=True)[columns].agg(operation).reset_index()
        return dataframe_result(result, reset_lineage=True, meta=dict(payload.meta))
