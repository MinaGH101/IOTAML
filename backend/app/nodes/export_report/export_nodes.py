from __future__ import annotations

import json
from app.nodes.base import BaseNode, port, setting
from app.nodes.io import dataframe_payload, ensure_df, node_label, output, run_file_path


class ExportCsvNode(BaseNode):
    cacheable = False
    id = 'EX-001'
    name = 'Export CSV'
    category = 'Export or Report'
    description = 'Writes the incoming dataframe to a CSV artifact with the workflow ID column first.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('artifact', 'CSV Artifact', 'artifact_ref')]
    settings_schema = [setting('filename', 'Filename', 'text', '')]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.export_df() if payload else None, str(node['id']))
        path = run_file_path(context, str(node['id']), 'csv')
        if settings.get('filename'):
            path = path.with_name(str(settings['filename']).replace('/', '_'))
        df.to_csv(path, index=False)
        return {'_df': df, '_id_column': payload.id_column if payload else None, 'artifact_ref': str(path), 'output': output(str(node['id']), node_label(node), 'artifact', path=str(path), rows=len(df))}


class ExportJsonNode(BaseNode):
    cacheable = False
    id = 'EX-005'
    name = 'Export JSON'
    category = 'Export or Report'
    description = 'Writes the incoming dataframe to a JSON artifact with the workflow ID field first.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('artifact', 'JSON Artifact', 'artifact_ref')]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.export_df() if payload else None, str(node['id']))
        path = run_file_path(context, str(node['id']), 'json')
        df.to_json(path, orient='records')
        return {'_df': df, '_id_column': payload.id_column if payload else None, 'artifact_ref': str(path), 'output': output(str(node['id']), node_label(node), 'artifact', path=str(path), rows=len(df))}


class SimpleReportNode(BaseNode):
    cacheable = False
    id = 'EX-006'
    name = 'Simple Report'
    category = 'Export or Report'
    description = 'Creates a lightweight JSON report from the incoming dataframe.'
    inputs = [port('data', 'DataFrame', 'dataframe')]
    outputs = [port('report', 'Report', 'report')]

    def run(self, node, inputs, settings, context):
        payload = dataframe_payload(inputs, 'data')
        df = ensure_df(payload.export_df() if payload else None, str(node['id']))
        report = {
            'rows': len(df),
            'columns': len(df.columns),
            'column_names': list(map(str, df.columns)),
            'id_column': payload.id_column if payload else None,
        }
        path = run_file_path(context, str(node['id']), 'report.json')
        path.write_text(json.dumps(report, indent=2), encoding='utf-8')
        return {'_df': df, '_id_column': payload.id_column if payload else None, 'report': report, 'artifact_ref': str(path), 'output': output(str(node['id']), node_label(node), 'artifact', path=str(path), report=report)}
