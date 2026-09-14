from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest

from app.core.config import Settings
from app.domains.datasets.table_reader import read_table
from app.nodes.io import dataframe_result, dataframe_payload
from app.nodes.ml_data_processing.split_node import TrainTestSplitNode
from app.nodes.ml_data_processing.kfold_node import KFoldSplitNode
from app.nodes.ml_data_processing.preprocessing_node import TrainingPreprocessorNode
from app.nodes.ml_training.model_nodes import LinearRegressionNode, predict_with_payload
from app.nodes.transformation.scaler_nodes import ScalerNode
from app.nodes.cleaning.persian_values_node import PersianValuesNode
from app.nodes.utilities.summary_nodes import RemoveDuplicatesNode, GroupSummaryNode
from app.workflow.graph.operations import upstream_outputs
from app.workflow.execution.executor import execute_workflow


CTX = SimpleNamespace(target_column='y', task_type='regression')


def test_holdout_never_fits_scaling_or_imputation():
    frame = pd.DataFrame({'x': [1., 3., np.nan, 5., 10000.], 'y': [2., 6., 6., 10., 20000.]})
    split = TrainTestSplitNode().run({'id': 'split'}, {'in': dataframe_result(frame)}, {'shuffle': False, 'test_size': .2}, CTX)
    prepared = TrainingPreprocessorNode().run({'id': 'prep'}, {'in': split}, {'imputation': 'median', 'scaling': 'standard'}, CTX)
    model = LinearRegressionNode().run({'id': 'model'}, {'in': prepared}, {}, CTX)['model']
    assert model.model.named_steps['imputer'].statistics_[0] == 3
    assert model.model.named_steps['scaler'].mean_[0] == 3
    np.testing.assert_allclose(predict_with_payload(model, pd.DataFrame({'x': [10000.]})), [20000.])
    assert frame['x'].isna().sum() == 1  # No upstream mutation.


def test_every_fold_fits_its_own_preprocessor():
    frame = pd.DataFrame({'x': [0., 2., 10., 12., 100., 102.], 'y': [0., 4., 20., 24., 200., 204.]})
    split = KFoldSplitNode().run({'id': 'split'}, {'in': dataframe_result(frame)}, {'shuffle': False, 'n_splits': 3}, CTX)
    prepared = TrainingPreprocessorNode().run({'id': 'prep'}, {'in': split}, {}, CTX)
    model = LinearRegressionNode().run({'id': 'model'}, {'in': prepared}, {}, CTX)['model']
    for index, fold in enumerate(split['kfold_data']['folds']):
        assert model.meta['fold_models'][index].named_steps['scaler'].mean_[0] == fold['X_train']['x'].mean()
        np.testing.assert_allclose(predict_with_payload(model, fold['X_test'], fold=index + 1), fold['y_test'], atol=1e-10)


def test_scaling_before_split_is_rejected():
    frame = dataframe_result(pd.DataFrame({'x': [1., 2., 30., 40.], 'y': [2., 4., 60., 80.]}))
    scaled = ScalerNode().run({'id': 'scale'}, {'in': frame}, {'columns': ['x']}, CTX)
    with pytest.raises(Exception, match='preprocessed before splitting'):
        TrainTestSplitNode().run({'id': 'split'}, {'in': scaled}, {}, CTX)


def test_selected_execution_skips_downstream_siblings_and_unconnected_invalid_nodes(tmp_path):
    path = tmp_path / 'data.csv'
    pd.DataFrame({'x': [1, 2], 'y': [2, 4]}).to_csv(path, index=False)
    def node(id, type, params=None):
        return {'id': id, 'data': {'registryId': type, 'params': params or {}}}
    graph = {'nodes': [node('input', 'DI-002'), node('selected', 'CL-006', {'columns': ['x']}),
                       node('sibling', 'UT-001'), node('downstream', 'UT-001'), node('unconnected', 'UNKNOWN')],
             'edges': [{'source': 'input', 'target': 'selected', 'sourceHandle': 'dataframe', 'targetHandle': 'data'},
                       {'source': 'input', 'target': 'sibling', 'sourceHandle': 'dataframe', 'targetHandle': 'input'},
                       {'source': 'selected', 'target': 'downstream', 'sourceHandle': 'dataframe', 'targetHandle': 'input'}]}
    result = execute_workflow(graph, None, 'y', 'regression', None, 'test', dataset_path=str(path), selected_node_id='selected', run_path=tmp_path / 'run')
    assert result['artifacts']['execution_plan']['order'] == ['input', 'selected']
    assert result['error'] is None


def test_ports_do_not_fall_back_to_sibling_data():
    value = {'dataframe': dataframe_result(pd.DataFrame({'x': [1]}))['dataframe'], 'report': {'value': 1}}
    inputs = upstream_outputs('child', [{'source': 'parent', 'target': 'child', 'sourceHandle': 'report', 'targetHandle': 'data'}], {'parent': value})
    assert dataframe_payload(inputs, 'data') is None
    with pytest.raises(ValueError, match='output port'):
        upstream_outputs('child', [{'source': 'parent', 'target': 'child', 'sourceHandle': 'missing'}], {'parent': value})
    assert dataframe_payload({'_by_port': {'other': [value]}, 'parent': value}, 'data') is None


def test_stale_column_selection_does_not_silently_select_every_column():
    from app.nodes.io import selected_columns
    with pytest.raises(Exception, match='not in the connected input'):
        selected_columns({'columns': ['removed']}, pd.DataFrame({'current': [1]}))


def test_new_id_uses_current_upstream_values_not_original_source():
    from app.nodes.io import apply_dataframe_contract
    from app.nodes.cleaning.select_columns_node import SelectColumnsNode
    source = dataframe_result(pd.DataFrame({'id': ['a', 'b'], 'x': [1, 2]}))
    transformed = apply_dataframe_contract(dataframe_result(pd.DataFrame({'id': ['A', 'B'], 'x': [1, 2]})), {'input': source})
    selected = SelectColumnsNode().run({'id': 'selected'}, {'input': transformed}, {'id_column': 'id', 'columns': ['x']}, CTX)
    assert selected['_df']['id'].tolist() == ['A', 'B']


def test_excel_tsv_and_persian_conversion(tmp_path):
    original = pd.DataFrame({'number': ['۱٬۲۳۴٫۵', '٢٫٥'], 'date': ['۱۴۰۳/۰۱/۰۱', '۱۴۰۳/۰۱/۰۲'], 'code': ['۰۰۱', '۰۰۲']})
    path = tmp_path / 'table.xlsx'
    original.to_excel(path, index=False)
    frame = read_table(path)
    # Keep identifier strings: explicitly converting selected columns avoids guessing.
    numbers = PersianValuesNode().run({'id': 'numbers'}, {'in': dataframe_result(original)}, {'columns': ['number']}, CTX)
    assert numbers['_df']['number'].tolist() == [1234.5, 2.5]
    assert numbers['_df']['code'].tolist() == ['۰۰۱', '۰۰۲']
    dates = PersianValuesNode().run({'id': 'dates'}, {'in': numbers}, {'columns': ['date'], 'kind': 'jalali'}, CTX)
    assert dates['_df']['date'].iloc[0] == pd.Timestamp('2024-03-20')
    assert list(frame.columns) == list(original.columns)
    assert len(read_table(path, max_rows=1)) == 1
    tsv = tmp_path / 'table.tsv'
    original.to_csv(tsv, index=False, sep='\t')
    assert read_table(tsv).shape == (2, 3)


def test_useful_nodes_do_not_mutate_input():
    frame = pd.DataFrame({'batch': ['a', 'a', 'b'], 'value': [2, 2, 4]})
    dedup = RemoveDuplicatesNode().run({'id': 'unique'}, {'in': dataframe_result(frame)}, {}, CTX)
    assert len(dedup['_df']) == 2
    grouped = GroupSummaryNode().run({'id': 'summary'}, {'in': dataframe_result(frame)}, {'group_by': 'batch', 'columns': ['value'], 'operation': 'sum'}, CTX)
    assert grouped['_df']['value'].tolist() == [4, 4]
    assert len(frame) == 3


def test_custom_code_cannot_be_enabled_without_os_isolation():
    assert Settings().allow_custom_code is False
    with pytest.raises(ValueError, match='OS-isolated'):
        Settings(allow_custom_code=True)


def test_row_filters_reject_python_calls_and_attributes():
    from app.nodes.cleaning.safe_query import filter_query
    frame = pd.DataFrame({'Au': [1, 2, 3], 'batch name': ['a', 'b', 'c']})
    assert filter_query(frame, 'Au >= 2 and `batch name` in ["b", "c"]').Au.tolist() == [2, 3]
    for expression in ['Au.__class__', '__import__("os")', '@pd.read_csv("data")', 'Au ** 1000000']:
        with pytest.raises((ValueError, SyntaxError)):
            filter_query(frame, expression)


def test_sql_sources_are_explicitly_authorized_and_never_return_credentials(monkeypatch):
    from app.core.config import get_settings
    from app.domains.datasets.sql_import import available_sources, import_sql_table
    from app.domains.datasets.routes import sql_sources
    from app.core.errors import ValidationAppError
    spec = {'url': 'postgresql://hidden:credential@internal/database', 'users': ['allowed'], 'tables': ['public.samples']}
    monkeypatch.setattr(get_settings(), 'sql_import_sources', {'lab': spec})
    allowed = SimpleNamespace(username='allowed', role='expert')
    denied = SimpleNamespace(username='denied', role='expert')
    assert available_sources(denied) == {}
    assert sql_sources(allowed) == [{'name': 'lab', 'tables': ['public.samples']}]
    with pytest.raises(ValidationAppError):
        import_sql_table(None, user=allowed, source='lab', table_name='public.private', project_id=1, owner_username='allowed', limit=100)
