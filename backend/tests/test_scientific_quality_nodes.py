from __future__ import annotations

import base64
from io import BytesIO

import pandas as pd
import pytest

from app.nodes.anomaly_detection.sorted_gap_node import SortedGapOutlierNode
from app.nodes.inspection.correlation_node import CorrelationMatrixNode
from app.nodes.inspection.duplicate_error_node import DuplicateSampleErrorNode
from app.nodes.io import dataframe_result
from app.nodes.registry import get_node_runner
from app.nodes.visualization.barplot_node import BarPlotNode
from app.nodes.visualization.pp_plot_node import PPPlotNode
from app.nodes.transformation.transpose_node import TransposeDataFrameNode


def _xlsx_file_value(frame: pd.DataFrame) -> dict[str, object]:
    buffer = BytesIO()
    frame.to_excel(buffer, index=False, engine='openpyxl')
    raw = buffer.getvalue()
    return {
        'name': 'duplicates.xlsx',
        'mime_type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'size': len(raw),
        'data_url': 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + base64.b64encode(raw).decode(),
    }


def test_duplicate_sample_error_reads_xlsx_and_exposes_error_dataframe() -> None:
    mapping = pd.DataFrame({'Raw Sample': ['A', 'B', 'C'], 'Duplicate Sample': ['AD', 'BD', 'CD']})
    frame = pd.DataFrame({
        'lab_id': ['A', 'AD', 'B', 'BD', 'C', 'CD'],
        'Au': [10.0, 11.0, 20.0, 18.0, 30.0, 33.0],
        'Cu': [100.0, 103.0, 200.0, 203.0, 300.0, 303.0],
    })
    result = DuplicateSampleErrorNode().run(
        {'id': 'dup', 'data': {'label': 'Duplicate Error'}},
        {'input': dataframe_result(frame, id_column='lab_id')},
        {
            'mapping_file': _xlsx_file_value(mapping),
            'mapping_raw_column': '',
            'mapping_duplicate_column': '',
            'dataframe_id_column': 'lab_id',
            'columns': ['Au', 'Cu'],
            'metrics': ['pair_count', 'mae', 'mae_pct', 'rmse', 'mean_rpd_pct', 'pearson_r'],
            'duplicate_id_policy': 'error',
            'max_pair_output_rows': 100,
        },
        None,
    )
    summary = result['_df'].set_index('column')
    assert summary.loc['Au', 'pair_count'] == 3
    assert summary.loc['Cu', 'mae'] == pytest.approx(3.0)
    assert summary.loc['Au', 'mae_pct'] == pytest.approx(10.0)
    assert summary.loc['Cu', 'mae_pct'] == pytest.approx(1.5)
    assert result['outputs_by_port']['errors']['_df'].equals(result['_df'])
    assert set(result['outputs_by_port']) == {'errors'}
    assert result['dataframe_meta']['duplicate_sample_error']['matched_pairs'] == 3


def test_transposed_error_output_can_feed_row_series_bar_plot() -> None:
    frame = pd.DataFrame({'error': ['mae', 'rmse'], 'Au': [1.2, 1.5], 'Cu': [3.4, 3.8]})
    result = BarPlotNode().run(
        {'id': 'bar', 'data': {'label': 'Duplicate Metrics'}},
        {'input': dataframe_result(frame, id_column='error')},
        {
            'x_columns': ['Au', 'Cu'],
            'selected_rows': ['mae', 'rmse'],
            'series_colors': {'mae': '#31cde3', 'rmse': '#8b7cf6'},
            'orientation': 'vertical',
            'guideline_values': '2, 5',
            'guideline_labels': 'warning, action',
        },
        None,
    )
    assert result['output']['kind'] == 'bar_plot'
    assert result['output']['categories'] == ['Au', 'Cu']
    assert result['output']['row_index_column'] == 'error'
    assert result['output']['series'][0] == {'label': 'mae', 'data': [1.2, 3.4], 'color': '#31cde3'}
    assert result['output']['series'][1]['color'] == '#8b7cf6'
    assert result['output']['guidelines'][0] == {'value': 2.0, 'label': 'warning'}


def test_pp_plot_and_correlation_heatmap_produce_plot_outputs() -> None:
    frame = pd.DataFrame({'x': [1, 2, 3, 4, 5, 6], 'y': [2, 4, 5, 8, 10, 12]})
    input_value = {'input': dataframe_result(frame)}
    pp = PPPlotNode().run(
        {'id': 'pp', 'data': {'label': 'P-P'}}, input_value,
        {'columns': ['x'], 'plotting_position': 'hazen', 'max_points': 100, 'color': '#31cde3'}, None,
    )
    assert pp['output']['kind'] == 'pp_plot'
    assert all(0 <= point['theoretical_probability'] <= 1 for point in pp['output']['points'])
    heatmap = CorrelationMatrixNode().run(
        {'id': 'corr', 'data': {'label': 'Correlation'}}, input_value,
        {'columns': ['x', 'y'], 'method': 'pearson', 'max_plot_columns': 18}, None,
    )
    assert heatmap['outputs'][0]['kind'] == 'heatmap'
    assert heatmap['outputs'][0]['labels'] == ['x', 'y']


def test_sorted_gap_outlier_caps_abrupt_upper_tail_and_adds_flags() -> None:
    frame = pd.DataFrame({'sample_id': list('abcdefghijkl'), 'value': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 70, 90]})
    result = SortedGapOutlierNode().run(
        {'id': 'gap', 'data': {'label': 'Sorted Gap'}},
        {'input': dataframe_result(frame, id_column='sample_id')},
        {
            'columns': ['value'], 'tail': 'upper', 'sensitivity': 3,
            'max_outlier_fraction': 0.25, 'minimum_regular_values': 5,
            'replacement': 'nearest_boundary', 'add_flag_columns': True,
            'max_plot_points': 1000, 'color': '#31cde3',
        },
        None,
    )
    corrected = result['_df']
    assert corrected['value'].max() == 10
    assert corrected['value__sorted_gap_outlier'].sum() == 2
    assert result['report']['summary'][0]['upper_boundary'] == 10.0
    assert result['outputs'][-1]['kind'] == 'stair_outlier'



def test_transpose_dataframe_uses_selected_row_labels_as_columns() -> None:
    frame = pd.DataFrame({'sample': ['A', 'B'], 'mae': [1.2, 3.4], 'rmse': [1.5, 3.8]})
    result = TransposeDataFrameNode().run(
        {'id': 'transpose', 'data': {'label': 'Transpose'}},
        {'input': dataframe_result(frame)},
        {'id_column': 'sample', 'first_column_name': 'metric'},
        None,
    )
    assert result['_df'].columns.tolist() == ['metric', 'A', 'B']
    assert result['_df']['metric'].tolist() == ['mae', 'rmse']

def test_new_nodes_are_available_in_registry() -> None:
    for node_id in ('IN-008', 'AD-005', 'TR-014', 'VZ-005', 'VZ-006'):
        assert get_node_runner(node_id) is not None
