from __future__ import annotations

from typing import Any

from app.nodes.base import BaseNode, NodeDefinition
from app.nodes.data_input.csv_node import CsvInputNode
from app.nodes.data_input.manual_json_node import ManualJsonInputNode
from app.nodes.data_input.manual_trigger_node import ManualTriggerNode
from app.nodes.inspection.data_overview_node import DataOverviewNode
from app.nodes.inspection.missing_values_node import MissingValuesReportNode
from app.nodes.inspection.correlation_node import CorrelationMatrixNode
from app.nodes.inspection.statistical_report_node import StatisticalReportNode
from app.nodes.cleaning.convert_type_node import ConvertTypeNode
from app.nodes.cleaning.select_columns_node import SelectColumnsNode
from app.nodes.cleaning.filter_dataframe_node import FilterDataFrameNode
from app.nodes.cleaning.replace_values_node import ReplaceValuesNode
from app.nodes.cleaning.imputation_node import ImputationNode
from app.nodes.cleaning.detection_limit_node import DetectionLimitHandlingNode
from app.nodes.anomaly_detection.z_score_node import ZScoreOutlierNode
from app.nodes.anomaly_detection.iqr_node import IQROutlierNode
from app.nodes.anomaly_detection.threshold_node import ThresholdAnomalyNode
from app.nodes.transformation.scaler_nodes import ScalerNode
from app.nodes.transformation.normalization_node import NormalizationNode
from app.nodes.transformation.ratio_node import RatioCalculatorNode
from app.nodes.visualization.histogram_node import HistogramNode
from app.nodes.visualization.scatter_node import ScatterPlotNode
from app.nodes.visualization.boxplot_node import BoxPlotNode
from app.nodes.ml_data_processing.split_node import TrainTestSplitNode
from app.nodes.ml_data_processing.kfold_node import KFoldSplitNode
from app.nodes.ml_data_processing.select_features_node import SelectFeaturesNode
from app.nodes.ml_data_processing.set_target_node import SetTargetNode
from app.nodes.ml_data_processing.feature_selection_nodes import MutualInfoFeatureScoreNode, FRegressionFeatureScoreNode
from app.nodes.ml_training.model_nodes import (
    DecisionTreeClassifierNode,
    DecisionTreeRegressorNode,
    ElasticNetRegressionNode,
    ExtraTreesClassifierNode,
    ExtraTreesRegressorNode,
    GaussianNBClassifierNode,
    GradientBoostingClassifierNode,
    GradientBoostingRegressorNode,
    HistGradientBoostingClassifierNode,
    HistGradientBoostingRegressorNode,
    KNNClassifierNode,
    KNNRegressorNode,
    LassoRegressionNode,
    LinearRegressionNode,
    LinearSVCClassifierNode,
    LogisticRegressionNode,
    RandomForestClassifierNode,
    RandomForestRegressorNode,
    RidgeRegressionNode,
    SVCClassifierNode,
)
from app.nodes.ml_analysis.model_analysis_nodes import PredictionPreviewNode, MetricsSummaryNode, FeatureImportanceNode
from app.nodes.export_report.export_nodes import ExportCsvNode, ExportJsonNode, SimpleReportNode
from app.nodes.utilities.python_code_node import PythonCodeNode
from app.nodes.utilities.passthrough_node import PassThroughNode
from app.nodes.utilities.merge_dataframes_node import MergeDataFramesNode

EXACT_CATEGORIES = [
    'Data Input',
    'Data Inspection',
    'Data Cleaning',
    'Anomaly Detection',
    'Transformation',
    'Visualizations',
    'ML Data Processing',
    'ML Regression Models',
    'ML Classification Models',
    'ML Model Analysis',
    'Export or Report',
    'Utilities / Advanced',
    'User Nodes',
]

NODE_CLASSES: list[type[BaseNode]] = [
    # Data Input
    ManualJsonInputNode, CsvInputNode, ManualTriggerNode,
    # Data Inspection
    DataOverviewNode, MissingValuesReportNode, CorrelationMatrixNode, StatisticalReportNode,
    # Data Cleaning
    ConvertTypeNode, SelectColumnsNode, FilterDataFrameNode, ReplaceValuesNode, ImputationNode, DetectionLimitHandlingNode,
    # Anomaly Detection
    ZScoreOutlierNode, IQROutlierNode, ThresholdAnomalyNode,
    # Transformation
    ScalerNode, NormalizationNode, RatioCalculatorNode,
    # Visualizations
    HistogramNode, ScatterPlotNode, BoxPlotNode,
    # ML Data Processing
    SelectFeaturesNode, TrainTestSplitNode, KFoldSplitNode, SetTargetNode, MutualInfoFeatureScoreNode, FRegressionFeatureScoreNode,
    # Regression Models
    LinearRegressionNode, RidgeRegressionNode, LassoRegressionNode, ElasticNetRegressionNode, DecisionTreeRegressorNode,
    RandomForestRegressorNode, ExtraTreesRegressorNode, GradientBoostingRegressorNode, HistGradientBoostingRegressorNode, KNNRegressorNode,
    # Classification Models
    LogisticRegressionNode, DecisionTreeClassifierNode, RandomForestClassifierNode, ExtraTreesClassifierNode, GradientBoostingClassifierNode,
    HistGradientBoostingClassifierNode, KNNClassifierNode, SVCClassifierNode, LinearSVCClassifierNode, GaussianNBClassifierNode,
    # ML Model Analysis
    PredictionPreviewNode, MetricsSummaryNode, FeatureImportanceNode,
    # Export or Report
    ExportCsvNode, ExportJsonNode, SimpleReportNode,
    # Utilities / Advanced
    PythonCodeNode, PassThroughNode, MergeDataFramesNode,
]

_REGISTRY: list[BaseNode] = [cls() for cls in NODE_CLASSES]
_BY_ID: dict[str, BaseNode] = {node.id: node for node in _REGISTRY}

LEGACY_NODE_ALIASES: dict[str, str] = {
    'TR-003': 'TR-020',
    'data_csv': 'DI-002',
    'data_demo': 'DI-002',
    'data_demo_iris': 'DI-002',
    'data_demo_wine': 'DI-002',
    'data_demo_breast_cancer': 'DI-002',
    'data_select_target_features': 'MP-002',
    'data_select_features': 'MP-002',
    'data_select_target': 'MP-002',
    'data_train_test_split': 'MP-001',
    'data_kfold_split': 'MP-004',
    'data_filter_rows': 'CL-007',
    'data_sort_rows': 'CL-007',
    'data_sample_rows': 'CL-006',
    'transform_drop_columns': 'CL-006',
    'transform_replace_values': 'CL-008',
    'transform_simple_imputer': 'CL-009',
    'transform_imputer': 'CL-009',
    'transform_standard_scaler': 'TR-020',
    'transform_minmax_scaler': 'TR-020',
    'transform_robust_scaler': 'TR-020',
    'transform_scaler': 'TR-020',
    'transform_normalization': 'TR-021',
    'analysis_summary': 'IN-001',
    'analysis_stats': 'IN-007',
    'analysis_missing': 'IN-004',
    'analysis_correlation': 'IN-006',
    'analysis_histogram': 'VZ-002',
    'analysis_scatter': 'VZ-003',
    'analysis_boxplot': 'VZ-004',
    'analysis_outliers': 'AD-001',
    'feature_mutual_info': 'MP-021',
    'feature_f_regression': 'MP-022',
    'model_linear_regression': 'MR-001',
    'model_ridge': 'MR-002',
    'model_lasso': 'MR-003',
    'model_elastic_net': 'MR-004',
    'model_decision_tree_regressor': 'MR-005',
    'model_random_forest_regressor': 'MR-006',
    'model_extra_trees_regressor': 'MR-007',
    'model_gradient_boosting_regressor': 'MR-008',
    'model_hist_gradient_boosting_regressor': 'MR-009',
    'model_knn_regressor': 'MR-010',
    'model_logistic_regression': 'MC-001',
    'model_decision_tree_classifier': 'MC-002',
    'model_random_forest_classifier': 'MC-003',
    'model_extra_trees_classifier': 'MC-004',
    'model_gradient_boosting_classifier': 'MC-005',
    'model_hist_gradient_boosting_classifier': 'MC-006',
    'model_knn_classifier': 'MC-007',
    'model_svc': 'MC-008',
    'model_linear_svc': 'MC-009',
    'model_gaussian_nb': 'MC-010',
    'model_metrics': 'MA-003',
    'model_feature_importance': 'MA-006',
    'model_prediction_preview': 'MA-001',
    'model_prediction_plot': 'MA-001',
}

SOURCE_NODE_IDS = {'DI-001', 'DI-002', 'DI-010'}
LEGACY_SOURCE_NODE_TYPES = {'data_csv', 'data_demo', 'data_demo_iris', 'data_demo_wine', 'data_demo_breast_cancer'}


PORT_COMPATIBILITY: dict[str, set[str]] = {
    'any': {'any', 'dataframe', 'json', 'json_items', 'series', 'columns', 'model', 'metrics', 'plot', 'file', 'report', 'artifact', 'artifact_ref', 'text', 'schema', 'trigger', 'stream'},
    'dataframe': {'dataframe', 'any', 'json', 'artifact_ref', 'report'},
    'json_items': {'json_items', 'json', 'any', 'artifact_ref', 'report', 'dataframe'},
    'json': {'json', 'json_items', 'any', 'metrics', 'report'},
    'metrics': {'metrics', 'json', 'any', 'report'},
    'plot': {'plot', 'artifact', 'artifact_ref', 'report', 'any'},
    'artifact_ref': {'artifact_ref', 'artifact', 'file', 'report', 'any'},
    'artifact': {'artifact', 'artifact_ref', 'file', 'report', 'any'},
    'file': {'file', 'artifact_ref', 'artifact', 'report', 'any'},
    'report': {'report', 'artifact', 'artifact_ref', 'file', 'json', 'any'},
    'model': {'model', 'artifact_ref', 'artifact', 'any'},
    'schema': {'schema', 'json', 'any'},
    'series': {'series', 'columns', 'json', 'any'},
    'columns': {'columns', 'json', 'any'},
    'text': {'text', 'json', 'any'},
    'trigger': {'trigger', 'any'},
    'stream': {'stream', 'json_items', 'any'},
}

VALID_PORT_TYPES = frozenset(PORT_COMPATIBILITY) | frozenset().union(*PORT_COMPATIBILITY.values())
CATALOG_VERSION = 1


def validate_registry_integrity() -> None:
    """Fail fast when catalog definitions drift or become internally invalid."""
    ids = [node.id for node in _REGISTRY]
    duplicate_ids = sorted({node_id for node_id in ids if ids.count(node_id) > 1})
    if duplicate_ids:
        raise RuntimeError(f'Duplicate node IDs: {", ".join(duplicate_ids)}')

    invalid_aliases = {
        alias: target
        for alias, target in LEGACY_NODE_ALIASES.items()
        if target not in _BY_ID
    }
    if invalid_aliases:
        details = ', '.join(f'{alias}->{target}' for alias, target in sorted(invalid_aliases.items()))
        raise RuntimeError(f'Legacy aliases target missing nodes: {details}')

    invalid_categories = sorted({node.category for node in _REGISTRY if node.category not in EXACT_CATEGORIES})
    if invalid_categories:
        raise RuntimeError(f'Unknown node categories: {", ".join(invalid_categories)}')

    invalid_ports: list[str] = []
    for node in _REGISTRY:
        for port_definition in [*node.inputs, *node.outputs]:
            if port_definition.type not in VALID_PORT_TYPES:
                invalid_ports.append(f'{node.id}.{port_definition.id}:{port_definition.type}')
    if invalid_ports:
        raise RuntimeError(f'Unknown port types: {", ".join(invalid_ports)}')


def catalog_metadata() -> dict[str, Any]:
    return {
        'version': CATALOG_VERSION,
        'aliases': dict(LEGACY_NODE_ALIASES),
        'categories': get_categories(),
        'compatiblePorts': {
            source_type: sorted(target_types)
            for source_type, target_types in PORT_COMPATIBILITY.items()
        },
    }


def canonical_node_id(node_id: str) -> str:
    return LEGACY_NODE_ALIASES.get(str(node_id), str(node_id))



def _get_custom_record(node_id: str):
    if not str(node_id).startswith('UC-'):
        return None
    import json
    import os
    from pathlib import Path
    from types import SimpleNamespace

    snapshot_path = os.getenv('IOTA_CUSTOM_NODE_SNAPSHOT')
    if snapshot_path:
        try:
            payload = json.loads(Path(snapshot_path).read_text(encoding='utf-8'))
            record = payload.get(str(node_id))
            if record:
                return SimpleNamespace(**record)
        except (OSError, json.JSONDecodeError):
            pass

    from app.database import SessionLocal
    from app.models import CustomNode
    with SessionLocal() as db:
        return db.get(CustomNode, str(node_id))

def all_nodes() -> list[NodeDefinition]:
    return [node.definition() for node in _REGISTRY]


def all_node_runners() -> list[BaseNode]:
    return list(_REGISTRY)


def all_nodes_api() -> list[dict[str, Any]]:
    return [node.to_api() for node in _REGISTRY]


def node_map() -> dict[str, NodeDefinition]:
    return {node_id: node.definition() for node_id, node in _BY_ID.items()}


def runner_map() -> dict[str, BaseNode]:
    return dict(_BY_ID)


def get_node(node_id: str) -> NodeDefinition | None:
    canonical = canonical_node_id(node_id)
    node = _BY_ID.get(canonical)
    if node:
        return node.definition()
    record = _get_custom_record(canonical)
    if record:
        from app.nodes.utilities.custom_python_node import CustomPythonNode
        return CustomPythonNode(record).definition()
    return None


def get_node_runner(node_id: str) -> BaseNode | None:
    canonical = canonical_node_id(node_id)
    node = _BY_ID.get(canonical)
    if node:
        return node
    record = _get_custom_record(canonical)
    if record:
        from app.nodes.utilities.custom_python_node import CustomPythonNode
        return CustomPythonNode(record)
    return None


def get_categories() -> list[str]:
    return list(EXACT_CATEGORIES)

validate_registry_integrity()
