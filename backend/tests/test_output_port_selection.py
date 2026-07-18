from __future__ import annotations

import pandas as pd

from app.nodes.io import dataframe_result, first_upstream_df, output, table_output
from app.nodes.transformation.normalization_node import NormalizationNode
from app.nodes.visualization.pp_plot_node import PPPlotNode
from app.workflow.executor import visible_node_output
from app.workflow.graph import upstream_outputs


def test_upstream_outputs_routes_only_selected_source_port() -> None:
    corrected = pd.DataFrame({'sample': ['A'], 'value': [10.0]})
    report = pd.DataFrame({'column': ['value'], 'outliers': [2]})
    source_result = {
        'outputs_by_port': {
            'dataframe': dataframe_result(corrected, id_column='sample'),
            'report': dataframe_result(report, id_column='column'),
        },
        'outputs': [
            table_output('source', 'Corrected', corrected),
            table_output('source', 'Report', report),
        ],
    }
    edges = [{
        'id': 'edge-1',
        'source': 'source',
        'sourceHandle': 'report',
        'target': 'target',
        'targetHandle': 'data',
    }]

    inputs = upstream_outputs('target', edges, {'source': source_result})
    selected = first_upstream_df(inputs, 'data')

    assert selected is not None
    assert selected.columns.tolist() == ['column', 'outliers']
    assert inputs['_edges'][0]['sourceHandle'] == 'report'


def test_visible_outputs_are_annotated_by_source_port() -> None:
    corrected = pd.DataFrame({'sample': ['A'], 'value': [10.0]})
    report = pd.DataFrame({'column': ['value'], 'outliers': [2]})
    plot = output('source', 'Stair Plot', 'stair_outlier', ranks=[1], original_values=[10.0])
    node = {
        'id': 'source',
        'data': {
            'label': 'Outlier Node',
            'registryId': 'AD-005',
            'outputs': [
                {'id': 'dataframe', 'name': 'Corrected DataFrame', 'type': 'dataframe'},
                {'id': 'report', 'name': 'Outlier Report', 'type': 'dataframe'},
                {'id': 'plot', 'name': 'Sorted Stair Plots', 'type': 'plot'},
            ],
        },
    }
    value = dataframe_result(
        corrected,
        id_column='sample',
        outputs_by_port={
            'dataframe': dataframe_result(corrected, id_column='sample'),
            'report': dataframe_result(report, id_column='column'),
            'plot': plot,
        },
        outputs=[table_output('source', 'Report', report), plot],
        output=table_output('source', 'Report', report),
    )

    visible = visible_node_output(node, value)
    outputs = visible if isinstance(visible, list) else [visible]
    by_handle = {item['source_handle']: item for item in outputs}

    assert set(by_handle) == {'dataframe', 'report', 'plot'}
    assert by_handle['dataframe']['columns'] == ['sample', 'value']
    assert by_handle['report']['columns'] == ['column', 'outliers']
    assert by_handle['plot']['kind'] == 'stair_outlier'


def test_normalization_dataframe_port_is_not_confused_with_report_preview() -> None:
    frame = pd.DataFrame({'sample': ['A', 'B', 'C', 'D'], 'x': [1.0, 2.0, 4.0, 8.0], 'untouched': [10, 20, 30, 40]})
    node = {
        'id': 'normalization',
        'data': {
            'label': 'Normalization',
            'registryId': 'TR-021',
            'outputs': [
                {'id': 'dataframe', 'name': 'Normalized DataFrame', 'type': 'dataframe'},
                {'id': 'report', 'name': 'Normalization Report', 'type': 'json'},
            ],
        },
    }
    result = NormalizationNode().run(
        node,
        {'input': dataframe_result(frame, id_column='sample')},
        {'normalization_blocks': [{'method': 'ln', 'columns': ['x'], 'offset': 0}], 'max_output_rows': 100},
        None,
    )

    visible = visible_node_output(node, result)
    outputs = visible if isinstance(visible, list) else [visible]
    by_handle = {item['source_handle']: item for item in outputs}

    assert by_handle['dataframe']['kind'] == 'table'
    assert by_handle['dataframe']['columns'] == ['sample', 'x', 'untouched']
    assert by_handle['report']['kind'] == 'json'

    edges = [{
        'id': 'normalization-to-pp',
        'source': 'normalization',
        'sourceHandle': 'dataframe',
        'target': 'pp',
        'targetHandle': 'data',
    }]
    pp_inputs = upstream_outputs('pp', edges, {'normalization': result})
    pp_result = PPPlotNode().run(
        {'id': 'pp', 'data': {'label': 'P-P'}},
        pp_inputs,
        {'columns': ['x'], 'plotting_position': 'hazen', 'max_points': 100, 'color': '#31cde3'},
        None,
    )
    assert pp_result['output']['kind'] == 'pp_plot'
