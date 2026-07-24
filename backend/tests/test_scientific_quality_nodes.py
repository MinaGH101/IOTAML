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


def test_workflow_id_is_preserved_outside_calculation_columns_and_can_change_from_source_columns() -> None:
    from app.nodes.cleaning.select_columns_node import SelectColumnsNode
    from app.nodes.io import apply_dataframe_contract, dataframe_payload, selected_columns

    frame = pd.DataFrame({
        'sample_id': ['A', 'B', 'C'],
        'batch_id': ['X1', 'X2', 'X3'],
        'Au': [1.0, 2.0, 3.0],
        'Cu': [10.0, 20.0, 30.0],
    })
    source = dataframe_result(frame, id_column='sample_id')

    first = SelectColumnsNode().run(
        {'id': 'select-1', 'data': {'label': 'Select'}},
        {'input': source},
        {'mode': 'select', 'columns': ['sample_id', 'Au'], 'id_column': None},
        None,
    )
    first_payload = dataframe_payload({'input': first})
    assert first_payload is not None
    assert first_payload.id_column == 'sample_id'
    assert first_payload.df.columns.tolist() == ['sample_id', 'Au']
    assert first_payload.active_columns == ['Au']
    assert first_payload.source_columns == ['sample_id', 'batch_id', 'Au', 'Cu']
    assert selected_columns({'columns': ['sample_id', 'Au']}, first_payload.df) == ['Au']

    second = SelectColumnsNode().run(
        {'id': 'select-2', 'data': {'label': 'Select'}},
        {'input': first},
        {'mode': 'select', 'columns': ['Au'], 'id_column': 'batch_id'},
        None,
    )
    second_payload = dataframe_payload({'input': second})
    assert second_payload is not None
    assert second_payload.id_column == 'batch_id'
    assert second_payload.df.columns.tolist() == ['batch_id', 'Au']
    assert second_payload.df['batch_id'].tolist() == ['X1', 'X2', 'X3']
    assert second_payload.active_columns == ['Au']

    legacy_node_result = {'_df': second_payload.df.assign(Au=second_payload.df['Au'] * 2)}
    normalized = apply_dataframe_contract(legacy_node_result, {'input': second})
    normalized_payload = dataframe_payload({'input': normalized})
    assert normalized_payload is not None
    assert normalized_payload.id_column == 'batch_id'
    assert normalized_payload.df.columns.tolist() == ['batch_id', 'Au']
    assert normalized_payload.source_columns == ['sample_id', 'batch_id', 'Au', 'Cu']


def test_duplicate_error_defaults_to_inherited_workflow_id() -> None:
    mapping = pd.DataFrame({'Raw Sample': ['A', 'B'], 'Duplicate Sample': ['AD', 'BD']})
    frame = pd.DataFrame({
        'lab_id': ['A', 'AD', 'B', 'BD'],
        'Au': [10.0, 11.0, 20.0, 18.0],
    })
    result = DuplicateSampleErrorNode().run(
        {'id': 'dup-default-id', 'data': {'label': 'Duplicate Error'}},
        {'input': dataframe_result(frame, id_column='lab_id')},
        {
            'mapping_file': _xlsx_file_value(mapping),
            'mapping_raw_column': '',
            'mapping_duplicate_column': '',
            'columns': ['lab_id', 'Au'],
            'metrics': ['pair_count', 'mae'],
            'duplicate_id_policy': 'error',
        },
        None,
    )
    assert result['dataframe_meta']['duplicate_sample_error']['dataframe_id_column'] == 'lab_id'
    assert result['_df']['column'].tolist() == ['Au']


def test_legacy_calculation_settings_cannot_modify_workflow_id() -> None:
    from app.nodes.cleaning.imputation_node import ImputationNode
    from app.nodes.io import dataframe_payload

    frame = pd.DataFrame({
        'sample_id': [None, 'B', 'C'],
        'Au': [1.0, None, 3.0],
    })
    source = dataframe_result(frame, id_column='sample_id')
    result = ImputationNode().run(
        {'id': 'impute-id-safety', 'data': {'label': 'Imputation'}},
        {'input': source},
        {'imputation_blocks': [{'method': 'constant', 'columns': ['sample_id', 'Au'], 'constant_value': 0}]},
        None,
    )
    payload = dataframe_payload({'input': result})
    assert payload is not None
    assert pd.isna(payload.df.loc[0, 'sample_id'])
    assert payload.df.loc[1, 'Au'] == 0
    assert payload.active_columns == ['Au']


def test_inspection_reports_exclude_id_from_calculations() -> None:
    from app.nodes.inspection.data_overview_node import DataOverviewNode
    from app.nodes.inspection.missing_values_node import MissingValuesReportNode
    from app.nodes.inspection.statistical_report_node import StatisticalReportNode

    frame = pd.DataFrame({'sample_id': ['A', None, 'C'], 'Au': [1.0, None, 3.0], 'Cu': [2.0, 4.0, 6.0]})
    source = {'input': dataframe_result(frame, id_column='sample_id')}

    overview = DataOverviewNode().run(
        {'id': 'overview-id-safety', 'data': {'label': 'Overview'}}, source, {'include': 'all'}, None,
    )
    assert overview['profile_report']['column_names'] == ['Au', 'Cu']
    assert overview['profile_report']['id_column'] == 'sample_id'

    missing = MissingValuesReportNode().run(
        {'id': 'missing-id-safety', 'data': {'label': 'Missing'}}, source, {}, None,
    )
    assert [row['column'] for row in missing['missing_report']['columns']] == ['Au', 'Cu']

    stats = StatisticalReportNode().run(
        {'id': 'stats-id-safety', 'data': {'label': 'Stats'}}, source, {'columns': [], 'metrics': ['count']}, None,
    )
    assert stats['report']['_df']['column'].tolist() == ['Au', 'Cu']
