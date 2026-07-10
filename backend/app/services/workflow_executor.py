from __future__ import annotations

import json
import math
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.datasets import load_breast_cancer, load_iris, load_wine
from sklearn.decomposition import PCA
from sklearn.ensemble import AdaBoostClassifier, AdaBoostRegressor, ExtraTreesClassifier, ExtraTreesRegressor, GradientBoostingClassifier, GradientBoostingRegressor, HistGradientBoostingClassifier, HistGradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.feature_selection import SelectKBest, VarianceThreshold, f_classif, f_regression, mutual_info_classif, mutual_info_regression
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import ElasticNet, Lasso, LinearRegression, LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import learning_curve, train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MinMaxScaler, OneHotEncoder, OrdinalEncoder, RobustScaler, StandardScaler
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from app.services.node_registry import get_node_map

MODEL_NODES = {
    "model_logistic_regression",
    "model_random_forest_classifier",
    "model_gradient_boosting_classifier",
    "model_svc",
    "model_knn_classifier",
    "model_decision_tree_classifier",
    "model_linear_regression",
    "model_ridge",
    "model_random_forest_regressor",
    "model_gradient_boosting_regressor",
    "model_extra_trees_classifier",
    "model_adaboost_classifier",
    "model_hist_gradient_boosting_classifier",
    "model_gaussian_nb",
    "model_mlp_classifier",
    "model_decision_tree_regressor",
    "model_knn_regressor",
    "model_svr",
    "model_extra_trees_regressor",
    "model_adaboost_regressor",
    "model_hist_gradient_boosting_regressor",
    "model_lasso",
    "model_elastic_net",
    "model_mlp_regressor",
}

CLASSIFIER_NODES = {
    "model_logistic_regression",
    "model_random_forest_classifier",
    "model_gradient_boosting_classifier",
    "model_svc",
    "model_knn_classifier",
    "model_decision_tree_classifier",
    "model_extra_trees_classifier",
    "model_adaboost_classifier",
    "model_hist_gradient_boosting_classifier",
    "model_gaussian_nb",
    "model_mlp_classifier",
}

TRANSFORM_NODES = {
    "transform_drop_columns",
    "transform_simple_imputer",
    "transform_standard_scaler",
    "transform_minmax_scaler",
    "transform_robust_scaler",
    "transform_one_hot",
    "transform_ordinal",
    "transform_pca",
    "transform_select_k_best",
    "transform_variance_threshold",
    "transform_replace_values",
}

DATA_ANALYSIS_NODES = {
    "analysis_summary",
    "analysis_missing",
    "analysis_correlation",
    "analysis_histogram",
    "analysis_scatter",
    "analysis_boxplot",
    "analysis_class_balance",
    "analysis_outliers",
    "analysis_feature_distribution",
    "analysis_pairwise_sample",
}

MODEL_ANALYSIS_NODES = {
    "model_metrics",
    "model_confusion_matrix",
    "model_roc_auc",
    "model_feature_importance",
    "model_permutation_importance",
    "model_shap_summary",
    "model_learning_curve",
    "model_residual_plot",
    "model_prediction_preview",
    "model_prediction_plot",
    "model_compare",
}


@dataclass
class ExecutionContext:
    df: pd.DataFrame | None = None
    target_column: str | None = None
    task_type: str = "auto"
    split: dict[str, Any] = field(default_factory=lambda: {"test_size": 0.2, "random_state": 42, "shuffle": True})
    analysis: dict[str, Any] = field(default_factory=dict)
    node_outputs: dict[str, Any] = field(default_factory=dict)




def columns_setting(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item)]
    if isinstance(value, str) and value.strip():
        return [item.strip() for item in value.split(',') if item.strip()]
    return []

def safe_json(value: Any) -> Any:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        if math.isnan(float(value)):
            return None
        return float(value)
    if isinstance(value, np.ndarray):
        return [safe_json(v) for v in value.tolist()]
    if isinstance(value, pd.Series):
        return {str(k): safe_json(v) for k, v in value.to_dict().items()}
    if isinstance(value, pd.DataFrame):
        return json.loads(value.where(value.notna(), None).to_json(orient="records"))
    if isinstance(value, dict):
        return {str(k): safe_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [safe_json(v) for v in value]
    if not isinstance(value, (list, dict, tuple, np.ndarray, pd.Series, pd.DataFrame)):
        try:
            if pd.isna(value):
                return None
        except Exception:
            pass
    return value


def node_params(node: dict[str, Any]) -> dict[str, Any]:
    return node.get("data", {}).get("params", {}) or {}


def registry_id(node: dict[str, Any]) -> str:
    return node.get("data", {}).get("registryId") or node.get("type") or "unknown"


def node_label(node: dict[str, Any]) -> str:
    return str(node.get("data", {}).get("label") or registry_id(node))


CHART_PARAM_KEYS = {"color", "x_min", "x_max", "y_min", "y_max"}


def chart_params(params: dict[str, Any]) -> dict[str, Any]:
    return {key: safe_json(value) for key, value in params.items() if key in CHART_PARAM_KEYS and value not in [None, ""]}


def parse_hidden_layers(value: Any) -> tuple[int, ...]:
    if isinstance(value, (list, tuple)):
        return tuple(int(v) for v in value if str(v).strip()) or (100,)
    parts = [part.strip() for part in str(value or "100").replace(";", ",").split(",") if part.strip()]
    return tuple(int(float(part)) for part in parts) or (100,)

def table_output(title: str, df: pd.DataFrame, max_rows: int = 100) -> dict[str, Any]:
    preview = df.head(max_rows).copy()
    return safe_json({
        "kind": "table",
        "title": title,
        "rows_total": len(df),
        "columns_total": len(df.columns),
        "columns": [str(c) for c in preview.columns],
        "rows": preview.to_dict(orient="records"),
    })


def metrics_output(title: str, metrics: dict[str, Any]) -> dict[str, Any]:
    return safe_json({"kind": "metrics", "title": title, "metrics": metrics})


def json_output(title: str, value: Any) -> dict[str, Any]:
    return safe_json({"kind": "json", "title": title, "value": value})

def sample_to_output(title: str, sample: Any) -> dict[str, Any]:
    if isinstance(sample, str):
        try:
            sample = json.loads(sample)
        except Exception:
            return json_output(title, sample)
    if isinstance(sample, list) and all(isinstance(row, dict) for row in sample):
        rows = sample[:500]
        columns = list(rows[0].keys()) if rows else []
        return safe_json({"kind": "table", "title": title, "rows_total": len(sample), "columns_total": len(columns), "columns": columns, "rows": rows, "pinned": True})
    if isinstance(sample, dict) and sample.get("kind"):
        output = dict(sample)
        output.setdefault("title", title)
        output["pinned"] = True
        return safe_json(output)
    return json_output(title, {"pinned": True, "value": sample})


def pinned_node_output(node: dict[str, Any], label: str) -> dict[str, Any] | None:
    pinned = (node.get("data", {}) or {}).get("pinned") or {}
    if not isinstance(pinned, dict) or not pinned.get("enabled"):
        return None
    sample = pinned.get("sample")
    if sample in [None, ""]:
        return None
    return sample_to_output(label, sample)


def build_paths(graph: dict[str, Any]) -> list[list[dict[str, Any]]]:
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    by_id = {node["id"]: node for node in nodes}
    outgoing: dict[str, list[str]] = {node["id"]: [] for node in nodes}
    incoming: dict[str, int] = {node["id"]: 0 for node in nodes}
    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        if source in outgoing and target in incoming:
            outgoing[source].append(target)
            incoming[target] += 1

    roots = [node_id for node_id, count in incoming.items() if count == 0]
    if not roots and nodes:
        roots = [nodes[0]["id"]]

    paths: list[list[dict[str, Any]]] = []

    def walk(node_id: str, path: list[str], seen: set[str]) -> None:
        if node_id in seen:
            raise ValueError("Workflow graph has a cycle. Only DAG workflows are supported.")
        next_seen = seen | {node_id}
        children = outgoing.get(node_id, [])
        if not children:
            paths.append([by_id[item] for item in path + [node_id]])
            return
        for child in children:
            walk(child, path + [node_id], next_seen)

    for root in roots:
        walk(root, [], set())

    return paths


def demo_dataset(kind: str) -> tuple[pd.DataFrame, str]:
    if kind == "data_demo_wine":
        data = load_wine(as_frame=True)
    elif kind == "data_demo_breast_cancer":
        data = load_breast_cancer(as_frame=True)
    else:
        data = load_iris(as_frame=True)
    return data.frame.copy(), "target"


def numeric_feature_columns(df: pd.DataFrame, target_column: str | None) -> list[str]:
    return [c for c in df.select_dtypes(include=[np.number]).columns.tolist() if c != target_column]


def feature_columns(df: pd.DataFrame, target_column: str | None) -> list[str]:
    return [c for c in df.columns.tolist() if c != target_column]


def apply_transform(df: pd.DataFrame, target_column: str | None, node_id: str, params: dict[str, Any]) -> pd.DataFrame:
    result = df.copy()
    features = feature_columns(result, target_column)
    numeric = numeric_feature_columns(result, target_column)

    if node_id == "transform_drop_columns":
        drop_cols = [c for c in params.get("columns", []) if c in result.columns and c != target_column]
        return result.drop(columns=drop_cols)

    if node_id == "transform_simple_imputer":
        strategy = params.get("strategy", "mean") or "mean"
        fill_value = params.get("fill_value", "0")
        if numeric:
            numeric_strategy = strategy if strategy in {"mean", "median", "most_frequent", "constant"} else "mean"
            imputer = SimpleImputer(strategy=numeric_strategy, fill_value=fill_value)
            result[numeric] = imputer.fit_transform(result[numeric])
        cat_cols = [c for c in features if c not in numeric]
        if cat_cols:
            cat_strategy = strategy if strategy in {"most_frequent", "constant"} else "most_frequent"
            imputer = SimpleImputer(strategy=cat_strategy, fill_value=fill_value)
            result[cat_cols] = imputer.fit_transform(result[cat_cols])
        return result

    if node_id == "transform_standard_scaler" and numeric:
        scaler = StandardScaler(with_mean=bool(params.get("with_mean", True)), with_std=bool(params.get("with_std", True)))
        result[numeric] = scaler.fit_transform(result[numeric])
        return result

    if node_id == "transform_minmax_scaler" and numeric:
        scaler = MinMaxScaler(feature_range=(float(params.get("feature_range_min", 0) or 0), float(params.get("feature_range_max", 1) or 1)))
        result[numeric] = scaler.fit_transform(result[numeric])
        return result

    if node_id == "transform_robust_scaler" and numeric:
        scaler = RobustScaler(with_centering=bool(params.get("with_centering", True)), with_scaling=bool(params.get("with_scaling", True)))
        result[numeric] = scaler.fit_transform(result[numeric])
        return result

    if node_id == "transform_one_hot":
        cat_cols = [c for c in features if c not in numeric]
        if cat_cols:
            result = pd.get_dummies(result, columns=cat_cols, dummy_na=False)
        return result

    if node_id == "transform_ordinal":
        cat_cols = [c for c in features if c not in numeric]
        if cat_cols:
            enc = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=int(params.get("unknown_value", -1) or -1))
            result[cat_cols] = enc.fit_transform(result[cat_cols].astype(str))
        return result

    if node_id == "transform_pca" and numeric:
        n_components = min(int(params.get("n_components", 2) or 2), len(numeric), max(1, len(result)))
        pca = PCA(n_components=n_components, whiten=bool(params.get("whiten", False)), random_state=int(params.get("random_state", 42) or 42))
        arr = pca.fit_transform(result[numeric].fillna(result[numeric].median(numeric_only=True)))
        base = result.drop(columns=numeric)
        pc_df = pd.DataFrame(arr, columns=[f"PC{i + 1}" for i in range(n_components)], index=result.index)
        if target_column and target_column in base.columns:
            target = base[[target_column]]
            base = base.drop(columns=[target_column])
            return pd.concat([base, pc_df, target], axis=1)
        return pd.concat([base, pc_df], axis=1)

    if node_id == "transform_select_k_best" and numeric:
        if not target_column or target_column not in result.columns:
            return result
        k_raw = params.get("k", 10)
        k = len(numeric) if str(k_raw).lower() == "all" else min(int(k_raw or 10), len(numeric))
        y = result[target_column]
        task_type = "classification" if y.dtype == "object" or y.nunique() <= max(20, int(len(y) * 0.05)) else "regression"
        selector = SelectKBest(score_func=choose_score_func(params.get("score_func", "auto") or "auto", task_type), k=k)
        X_num = result[numeric].fillna(result[numeric].median(numeric_only=True))
        selector.fit(X_num, y)
        keep_numeric = [c for c, keep in zip(numeric, selector.get_support()) if keep]
        keep = [c for c in result.columns if c not in numeric] + keep_numeric
        return result[keep]

    if node_id == "transform_variance_threshold" and numeric:
        selector = VarianceThreshold(threshold=float(params.get("threshold", 0.0) or 0.0))
        X_num = result[numeric].fillna(result[numeric].median(numeric_only=True))
        selector.fit(X_num)
        keep_numeric = [c for c, keep in zip(numeric, selector.get_support()) if keep]
        drop_numeric = [c for c in numeric if c not in keep_numeric]
        return result.drop(columns=drop_numeric)

    if node_id == "transform_replace_values":
        cols = [c for c in params.get("columns", []) if c in result.columns]
        if not cols:
            cols = feature_columns(result, target_column)
        mask = pd.Series(True, index=result.index)
        row_filter = str(params.get("row_filter") or "").strip()
        if row_filter:
            try:
                filtered_index = result.query(row_filter).index
                mask = result.index.isin(filtered_index)
            except Exception as exc:
                raise ValueError(f"Invalid row filter for Replace Values: {exc}") from exc
        find_value = str(params.get("find_value", ""))
        replace_value = params.get("replace_value", "")
        regex = bool(params.get("regex", False))
        case = bool(params.get("case_sensitive", True))
        for col in cols:
            series = result.loc[mask, col]
            if regex or series.dtype == object:
                result.loc[mask, col] = series.astype(str).str.replace(find_value, str(replace_value), regex=regex, case=case)
            else:
                result.loc[mask & (result[col].astype(str) == find_value), col] = replace_value
        return result

    return result


def load_context(path: list[dict[str, Any]], dataset_df: pd.DataFrame | None, run_target: str | None, task_type: str) -> ExecutionContext:
    context = ExecutionContext(df=dataset_df.copy() if dataset_df is not None else None, target_column=run_target, task_type=task_type)

    for node in path:
        rid = registry_id(node)
        params = node_params(node)
        label = node_label(node)
        pinned_output = pinned_node_output(node, label)
        if pinned_output is not None:
            context.node_outputs[node["id"]] = pinned_output
            if pinned_output.get("kind") == "table" and isinstance(pinned_output.get("rows"), list):
                context.df = pd.DataFrame(pinned_output.get("rows") or [])
            continue

        if rid.startswith("data_demo"):
            context.df, context.target_column = demo_dataset(rid)
            context.node_outputs[node["id"]] = table_output(label, context.df)
        elif rid == "data_csv":
            if context.df is None:
                raise ValueError("No uploaded CSV was selected for this run.")
            context.node_outputs[node["id"]] = table_output(label, context.df)
        elif rid == "data_select_target_features" and context.df is not None:
            target = params.get("target_column") or context.target_column
            if target:
                context.target_column = str(target)
            cols = [c for c in params.get("feature_columns", []) if c in context.df.columns and c != context.target_column]
            if bool(params.get("select_all_features", True)) or not cols:
                cols = [c for c in context.df.columns if c != context.target_column]
            keep = cols + ([context.target_column] if context.target_column and context.target_column in context.df.columns else [])
            context.df = context.df[keep]
            context.node_outputs[node["id"]] = table_output(label, context.df)
        elif rid == "data_select_target" and params.get("target_column"):
            context.target_column = params.get("target_column")
            if context.df is not None:
                context.node_outputs[node["id"]] = table_output(label, context.df)
        elif rid == "data_select_features" and context.df is not None and params.get("columns"):
            keep = [col for col in params.get("columns", []) if col in context.df.columns]
            if context.target_column and context.target_column in context.df.columns and context.target_column not in keep:
                keep.append(context.target_column)
            context.df = context.df[keep]
            context.node_outputs[node["id"]] = table_output(label, context.df)
        elif rid == "data_filter_rows" and context.df is not None:
            if params.get("expression"):
                context.df = context.df.query(str(params["expression"]))
            context.node_outputs[node["id"]] = table_output(label, context.df)
        elif rid == "data_sort_rows" and context.df is not None:
            if params.get("column") in context.df.columns:
                context.df = context.df.sort_values(by=params["column"], ascending=bool(params.get("ascending", True)))
            context.node_outputs[node["id"]] = table_output(label, context.df)
        elif rid == "data_sample_rows" and context.df is not None:
            frac = float(params.get("frac", 1.0) or 1.0)
            if 0 < frac < 1:
                context.df = context.df.sample(frac=frac, random_state=int(params.get("random_state", 42) or 42))
            context.node_outputs[node["id"]] = table_output(label, context.df)
        elif rid == "data_train_test_split":
            context.split = {
                "test_size": float(params.get("test_size", 0.2) or 0.2),
                "random_state": int(params.get("random_state", 42) or 42),
                "shuffle": bool(params.get("shuffle", True)),
            }
            context.node_outputs[node["id"]] = json_output(label, context.split)
        elif rid in TRANSFORM_NODES and context.df is not None:
            context.df = apply_transform(context.df, context.target_column, rid, params)
            context.node_outputs[node["id"]] = table_output(label, context.df)
        elif rid in DATA_ANALYSIS_NODES and context.df is not None:
            analysis = analyze_dataframe(rid, context.df, context.target_column, params)
            context.analysis[rid] = analysis
            context.node_outputs[node["id"]] = analysis_to_output(label, rid, analysis, params)

    if context.df is None:
        raise ValueError("No dataset found. Add a CSV Dataset node or demo dataset node.")
    return context


def infer_task_type(y: pd.Series, requested: str, model_id: str | None = None) -> str:
    if requested in {"classification", "regression"}:
        return requested
    if model_id in CLASSIFIER_NODES:
        return "classification"
    if model_id and model_id.startswith("model_") and model_id not in CLASSIFIER_NODES:
        return "regression"
    if y.dtype == "object" or y.dtype.name == "category" or y.nunique() <= max(20, int(len(y) * 0.05)):
        return "classification"
    return "regression"


def get_xy(df: pd.DataFrame, target_column: str | None) -> tuple[pd.DataFrame, pd.Series]:
    if not target_column:
        raise ValueError("Target column is required. Add Select Target & Features node or set target column in the topbar.")
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' does not exist in dataset.")
    clean = df.dropna(subset=[target_column]).copy()
    X = clean.drop(columns=[target_column])
    y = clean[target_column]
    return X, y


def choose_score_func(name: str, task_type: str):
    if name == "f_classif":
        return f_classif
    if name == "f_regression":
        return f_regression
    if name == "mutual_info_classif":
        return mutual_info_classif
    if name == "mutual_info_regression":
        return mutual_info_regression
    return f_classif if task_type == "classification" else f_regression


def clean_params(params: dict[str, Any]) -> dict[str, Any]:
    cleaned = {k: v for k, v in params.items() if v not in [""] and k not in CHART_PARAM_KEYS}
    if "hidden_layer_sizes" in cleaned:
        cleaned["hidden_layer_sizes"] = parse_hidden_layers(cleaned["hidden_layer_sizes"])
    return cleaned


def build_model(model_id: str, params: dict[str, Any]):
    p = clean_params(params)
    if model_id == "model_logistic_regression":
        if p.get("penalty") == "elasticnet" and p.get("solver") != "saga":
            p["solver"] = "saga"
            p.setdefault("l1_ratio", 0.5)
        if p.get("penalty") == "l1" and p.get("solver") == "lbfgs":
            p["solver"] = "liblinear"
        return LogisticRegression(**p)
    if model_id == "model_random_forest_classifier":
        return RandomForestClassifier(**p)
    if model_id == "model_gradient_boosting_classifier":
        return GradientBoostingClassifier(**p)
    if model_id == "model_svc":
        return SVC(**p)
    if model_id == "model_knn_classifier":
        return KNeighborsClassifier(**p)
    if model_id == "model_decision_tree_classifier":
        return DecisionTreeClassifier(**p)
    if model_id == "model_linear_regression":
        return LinearRegression(**p)
    if model_id == "model_ridge":
        return Ridge(**p)
    if model_id == "model_random_forest_regressor":
        return RandomForestRegressor(**p)
    if model_id == "model_gradient_boosting_regressor":
        return GradientBoostingRegressor(**p)
    if model_id == "model_extra_trees_classifier":
        return ExtraTreesClassifier(**p)
    if model_id == "model_adaboost_classifier":
        return AdaBoostClassifier(**p)
    if model_id == "model_hist_gradient_boosting_classifier":
        return HistGradientBoostingClassifier(**p)
    if model_id == "model_gaussian_nb":
        return GaussianNB(**p)
    if model_id == "model_mlp_classifier":
        return MLPClassifier(**p)
    if model_id == "model_decision_tree_regressor":
        return DecisionTreeRegressor(**p)
    if model_id == "model_knn_regressor":
        return KNeighborsRegressor(**p)
    if model_id == "model_svr":
        return SVR(**p)
    if model_id == "model_extra_trees_regressor":
        return ExtraTreesRegressor(**p)
    if model_id == "model_adaboost_regressor":
        return AdaBoostRegressor(**p)
    if model_id == "model_hist_gradient_boosting_regressor":
        return HistGradientBoostingRegressor(**p)
    if model_id == "model_lasso":
        return Lasso(**p)
    if model_id == "model_elastic_net":
        return ElasticNet(**p)
    if model_id == "model_mlp_regressor":
        return MLPRegressor(**p)
    raise ValueError(f"Unsupported model node: {model_id}")


def build_preprocessor(X: pd.DataFrame) -> Pipeline:
    numeric_features = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_features = [col for col in X.columns if col not in numeric_features]
    transformers: list[tuple[str, Any, list[str]]] = []
    if numeric_features:
        transformers.append(("numeric", Pipeline([("imputer", SimpleImputer(strategy="median"))]), numeric_features))
    if categorical_features:
        transformers.append(("categorical", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False))]), categorical_features))
    return ColumnTransformer(transformers=transformers, remainder="drop")


def train_branch(context: ExecutionContext, model_node: dict[str, Any], path: list[dict[str, Any]], run_path: Path) -> dict[str, Any]:
    model_id = registry_id(model_node)
    model_label = node_label(model_node)
    X, y = get_xy(context.df, context.target_column)
    task_type = infer_task_type(y, context.task_type, model_id)

    stratify = y if task_type == "classification" and y.nunique() > 1 and y.value_counts().min() >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(X, y, stratify=stratify, **context.split)
    pipeline = Pipeline([("preprocess", build_preprocessor(X_train)), ("model", build_model(model_id, node_params(model_node)))])
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_train_pred = pipeline.predict(X_train)
    metrics = compute_metrics(task_type, y_test, y_pred, pipeline, X_test)
    prediction_rows = prediction_table(y_test, y_pred, max_rows=500)
    train_prediction_rows = prediction_table(y_train, y_train_pred, max_rows=500)

    result: dict[str, Any] = {
        "branch": model_label,
        "model_id": model_id,
        "task_type": task_type,
        "target_column": context.target_column,
        "rows": int(len(context.df)),
        "features": int(X.shape[1]),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "metrics": metrics,
        "analysis": dict(context.analysis),
        "node_outputs": dict(context.node_outputs),
        "predictions": prediction_rows,
        "train_predictions": train_prediction_rows,
        "feature_meta": {"features": X.columns.tolist(), "numeric_features": X.select_dtypes(include=[np.number]).columns.tolist()},
    }

    result["node_outputs"][model_node["id"]] = metrics_output(f"آموزش مدل: {model_label}", metrics)

    run_path.mkdir(parents=True, exist_ok=True)
    model_file = run_path / f"{model_node['id']}.joblib"
    joblib.dump(pipeline, model_file)
    result["model_artifact"] = str(model_file)

    for node in path:
        rid = registry_id(node)
        if rid in MODEL_ANALYSIS_NODES:
            analysis = analyze_model(rid, pipeline, X_train, X_test, y_train, y_test, y_train_pred, y_pred, task_type, node_params(node), result)
            result["analysis"][rid] = analysis
            result["node_outputs"][node["id"]] = model_analysis_to_output(node_label(node), rid, analysis, node_params(node))

    return safe_json(result)


def prediction_table(y_true: pd.Series, y_pred: np.ndarray, max_rows: int = 500) -> list[dict[str, Any]]:
    return safe_json(pd.DataFrame({"index": y_true.index.tolist(), "y_true": y_true.tolist(), "y_pred": pd.Series(y_pred).tolist()}).head(max_rows).to_dict(orient="records"))


def compute_metrics(task_type: str, y_test: pd.Series, y_pred: np.ndarray, pipeline: Pipeline, X_test: pd.DataFrame) -> dict[str, Any]:
    if task_type == "classification":
        average = "binary" if pd.Series(y_test).nunique() == 2 else "weighted"
        metrics = {
            "accuracy": accuracy_score(y_test, y_pred),
            "balanced_accuracy": balanced_accuracy_score(y_test, y_pred),
            "precision": precision_score(y_test, y_pred, average=average, zero_division=0),
            "recall": recall_score(y_test, y_pred, average=average, zero_division=0),
            "f1": f1_score(y_test, y_pred, average=average, zero_division=0),
        }
        try:
            if hasattr(pipeline, "predict_proba"):
                proba = pipeline.predict_proba(X_test)
                if proba.shape[1] == 2:
                    metrics["roc_auc"] = roc_auc_score(y_test, proba[:, 1])
                else:
                    metrics["roc_auc_ovr"] = roc_auc_score(y_test, proba, multi_class="ovr")
        except Exception:
            pass
        return safe_json(metrics)

    return safe_json({
        "r2": r2_score(y_test, y_pred),
        "mae": mean_absolute_error(y_test, y_pred),
        "rmse": mean_squared_error(y_test, y_pred) ** 0.5,
    })


def analyze_dataframe(node_id: str, df: pd.DataFrame, target_column: str | None, params: dict[str, Any]) -> dict[str, Any]:
    numeric = df.select_dtypes(include=[np.number])
    if node_id == "analysis_summary":
        missing = df.isna().sum().to_dict()
        return safe_json({
            "rows": len(df),
            "columns": len(df.columns),
            "column_types": df.dtypes.astype(str).to_dict(),
            "missing": missing,
            "numeric_stats": numeric.describe().T.round(4).to_dict(orient="index") if not numeric.empty else {},
        })
    if node_id == "analysis_missing":
        return safe_json(pd.DataFrame({"column": df.columns, "missing": df.isna().sum().values, "missing_percent": (df.isna().mean().values * 100).round(3)}).sort_values("missing", ascending=False).to_dict(orient="records"))
    if node_id == "analysis_correlation":
        method = params.get("method", "pearson") or "pearson"
        return safe_json(numeric.corr(method=method).round(4)) if not numeric.empty else {}
    if node_id == "analysis_histogram":
        selected = columns_setting(params.get("columns"))
        if not selected:
            column = params.get("column") or (numeric.columns[0] if len(numeric.columns) else None)
            selected = [str(column)] if column else []
        selected = [col for col in selected if col in df.columns]
        if not selected:
            return {"error": "Choose at least one numeric column."}
        bins = int(params.get("bins", 20) or 20)
        plots = []
        for column in selected:
            values = pd.to_numeric(df[column], errors="coerce").dropna()
            if values.empty:
                continue
            counts, edges = np.histogram(values, bins=bins)
            plots.append({"column": column, "counts": counts, "edges": edges})
        if not plots:
            return {"error": "Selected columns have no numeric values."}
        return safe_json({"plots": plots}) if len(plots) > 1 else safe_json(plots[0])
    if node_id == "analysis_scatter":
        x = params.get("x") or (numeric.columns[0] if len(numeric.columns) else None)
        y = params.get("y") or (numeric.columns[1] if len(numeric.columns) > 1 else None)
        if not x or not y:
            return {"error": "Choose two numeric columns."}
        sample = df[[x, y]].dropna().head(500)
        return safe_json({"x": x, "y": y, "points": sample.to_dict(orient="records")})
    if node_id == "analysis_boxplot":
        selected = columns_setting(params.get("columns"))
        if not selected:
            column = params.get("column") or (numeric.columns[0] if len(numeric.columns) else None)
            selected = [str(column)] if column else []
        selected = [col for col in selected if col in df.columns]
        if not selected:
            return {"error": "Choose at least one numeric column."}
        plots = []
        for column in selected:
            s = pd.to_numeric(df[column], errors="coerce").dropna()
            if s.empty:
                continue
            plots.append({"column": column, "quantiles": s.quantile([0, 0.25, 0.5, 0.75, 1]).to_dict()})
        if not plots:
            return {"error": "Selected columns have no numeric values."}
        return safe_json({"plots": plots}) if len(plots) > 1 else safe_json(plots[0])
    if node_id == "analysis_class_balance":
        if not target_column or target_column not in df.columns:
            return {"error": "Target column required."}
        return safe_json(pd.DataFrame({"class": df[target_column].value_counts(dropna=False).index.astype(str), "count": df[target_column].value_counts(dropna=False).values}).to_dict(orient="records"))
    if node_id == "analysis_outliers":
        rows = []
        for col in numeric.columns:
            q1, q3 = numeric[col].quantile([0.25, 0.75])
            iqr = q3 - q1
            rows.append({"column": col, "outliers": int(((numeric[col] < q1 - 1.5 * iqr) | (numeric[col] > q3 + 1.5 * iqr)).sum())})
        return safe_json(rows)
    if node_id == "analysis_feature_distribution":
        return safe_json(numeric.agg(["mean", "std", "min", "max", "skew"]).round(4).T.reset_index(names="column").to_dict(orient="records"))
    if node_id == "analysis_pairwise_sample":
        max_points = int(params.get("max_points", 300) or 300)
        return safe_json(numeric.head(max_points).to_dict(orient="records"))
    return {}


def analysis_to_output(title: str, node_id: str, analysis: Any, params: dict[str, Any] | None = None) -> dict[str, Any]:
    if isinstance(analysis, dict) and analysis.get("error"):
        return json_output(title, analysis)
    if node_id == "analysis_summary":
        rows = [{"metric": "rows", "value": analysis.get("rows")}, {"metric": "columns", "value": analysis.get("columns")}]
        rows += [{"metric": f"missing:{k}", "value": v} for k, v in analysis.get("missing", {}).items()]
        return {"kind": "table", "title": title, "columns": ["metric", "value"], "rows": rows, "rows_total": len(rows), "columns_total": 2}
    if node_id in {"analysis_missing", "analysis_outliers", "analysis_feature_distribution", "analysis_class_balance"} and isinstance(analysis, list):
        cols = list(analysis[0].keys()) if analysis else []
        return {"kind": "table", "title": title, "columns": cols, "rows": analysis, "rows_total": len(analysis), "columns_total": len(cols)}
    if node_id == "analysis_correlation" and isinstance(analysis, list):
        return {"kind": "table", "title": title, "columns": list(analysis[0].keys()) if analysis else [], "rows": analysis, "rows_total": len(analysis), "columns_total": len(analysis[0].keys()) if analysis else 0}
    params = params or {}
    if node_id == "analysis_histogram":
        if isinstance(analysis, dict) and isinstance(analysis.get("plots"), list):
            plots = [{"kind": "histogram", "title": f"{title} · {item.get('column')}", **item, **chart_params(params)} for item in analysis.get("plots", [])]
            return {"kind": "plot_group", "title": title, "plots": plots, "count": len(plots), "layout": "vertical"}
        return {"kind": "histogram", "title": title, **analysis, **chart_params(params)}
    if node_id == "analysis_scatter":
        return {"kind": "scatter", "title": title, **analysis, **chart_params(params)}
    if node_id == "analysis_boxplot":
        if isinstance(analysis, dict) and isinstance(analysis.get("plots"), list):
            plots = [{"kind": "boxplot", "title": f"{title} · {item.get('column')}", **item, **chart_params(params)} for item in analysis.get("plots", [])]
            return {"kind": "plot_group", "title": title, "plots": plots, "count": len(plots), "layout": "vertical"}
        return {"kind": "boxplot", "title": title, **analysis, **chart_params(params)}
    return json_output(title, analysis)


def transformed_feature_names(pipeline: Pipeline, fallback: list[str]) -> list[str]:
    try:
        preprocess = pipeline.named_steps.get("preprocess")
        names = preprocess.get_feature_names_out().tolist() if preprocess is not None else fallback
        return [str(name).replace("numeric__", "").replace("categorical__", "") for name in names]
    except Exception:
        return fallback


def analyze_model(node_id: str, pipeline: Pipeline, X_train: pd.DataFrame, X_test: pd.DataFrame, y_train: pd.Series, y_test: pd.Series, y_train_pred: np.ndarray, y_pred: np.ndarray, task_type: str, params: dict[str, Any], branch_result: dict[str, Any]) -> dict[str, Any]:
    if node_id == "model_metrics":
        selected = params.get("metrics") or []
        if not isinstance(selected, list) or not selected:
            return branch_result["metrics"]
        return {k: v for k, v in branch_result["metrics"].items() if k in selected or (k == "roc_auc_ovr" and "roc_auc" in selected)}
    if node_id == "model_confusion_matrix":
        if task_type != "classification":
            return {"error": "Confusion matrix is classification-only."}
        labels = sorted(pd.Series(y_test).dropna().unique().tolist())
        return safe_json({"labels": labels, "matrix": confusion_matrix(y_test, y_pred, labels=labels)})
    if node_id == "model_roc_auc":
        if task_type != "classification" or not hasattr(pipeline, "predict_proba"):
            return {"error": "ROC AUC requires a classifier with predict_proba."}
        proba = pipeline.predict_proba(X_test)
        if proba.shape[1] == 2:
            return safe_json({"roc_auc": roc_auc_score(y_test, proba[:, 1])})
        return safe_json({"roc_auc_ovr": roc_auc_score(y_test, proba, multi_class="ovr")})
    if node_id == "model_feature_importance":
        return native_feature_importance(pipeline, X_test.columns.tolist(), int(params.get("top_n", 20) or 20))
    if node_id == "model_permutation_importance":
        top_n = int(params.get("top_n", 20) or 20)
        scoring = "accuracy" if task_type == "classification" else "r2"
        result = permutation_importance(pipeline, X_test, y_test, scoring=scoring, n_repeats=int(params.get("n_repeats", 5) or 5), random_state=int(params.get("random_state", 42) or 42), n_jobs=-1)
        rows = sorted([{"feature": feature, "importance_mean": mean, "importance_std": std} for feature, mean, std in zip(X_test.columns.tolist(), result.importances_mean, result.importances_std)], key=lambda row: abs(row["importance_mean"]), reverse=True)[:top_n]
        return safe_json(rows)
    if node_id == "model_shap_summary":
        return shap_summary(pipeline, X_test, params)
    if node_id == "model_learning_curve":
        sizes = [float(item.strip()) for item in str(params.get("train_sizes", "0.2,0.5,0.8,1.0")).split(",") if item.strip()]
        scoring = "accuracy" if task_type == "classification" else "r2"
        train_sizes, train_scores, test_scores = learning_curve(pipeline, pd.concat([X_train, X_test]), pd.concat([y_train, y_test]), cv=int(params.get("cv", 3) or 3), train_sizes=np.array(sizes), scoring=scoring)
        return safe_json({"train_sizes": train_sizes, "train_score_mean": train_scores.mean(axis=1), "test_score_mean": test_scores.mean(axis=1)})
    if node_id == "model_residual_plot":
        if task_type != "regression":
            return {"error": "Residuals are regression-only."}
        max_points = int(params.get("max_points", 300) or 300)
        return safe_json(pd.DataFrame({"y_pred": y_pred, "residual": np.asarray(y_test) - y_pred}).head(max_points).to_dict(orient="records"))
    if node_id == "model_prediction_preview":
        max_rows = int(params.get("max_rows", 50) or 50)
        return prediction_table(y_test, y_pred, max_rows)
    if node_id == "model_prediction_plot":
        split = params.get("split", "test") or "test"
        max_points = int(params.get("max_points", 300) or 300)
        if split == "train":
            return prediction_table(y_train, y_train_pred, max_points)
        return prediction_table(y_test, y_pred, max_points)
    if node_id == "model_compare":
        return {"message": "Comparison is calculated across all branches in the run summary."}
    return {}


def model_analysis_to_output(title: str, node_id: str, analysis: Any, params: dict[str, Any] | None = None) -> dict[str, Any]:
    if isinstance(analysis, dict) and analysis.get("error"):
        return json_output(title, analysis)
    if node_id in {"model_metrics", "model_roc_auc"} and isinstance(analysis, dict):
        return metrics_output(title, analysis)
    if node_id == "model_confusion_matrix" and isinstance(analysis, dict):
        return {"kind": "matrix", "title": title, **analysis}
    if node_id in {"model_feature_importance", "model_permutation_importance", "model_shap_summary"} and isinstance(analysis, list):
        cols = list(analysis[0].keys()) if analysis else []
        return {"kind": "bar", "title": title, "columns": cols, "rows": analysis, "xKey": cols[0] if cols else "feature", "yKey": cols[1] if len(cols) > 1 else "importance", **chart_params(params)}
    if node_id == "model_learning_curve" and isinstance(analysis, dict):
        return {"kind": "line", "title": title, **analysis, **chart_params(params)}
    params = params or {}
    if node_id in {"model_residual_plot", "model_prediction_plot"} and isinstance(analysis, list):
        return {"kind": "scatter", "title": title, "x": "y_true" if node_id == "model_prediction_plot" else "y_pred", "y": "y_pred" if node_id == "model_prediction_plot" else "residual", "points": analysis, **chart_params(params)}
    if node_id == "model_prediction_preview" and isinstance(analysis, list):
        return {"kind": "table", "title": title, "columns": list(analysis[0].keys()) if analysis else [], "rows": analysis, "rows_total": len(analysis), "columns_total": len(analysis[0].keys()) if analysis else 0}
    return json_output(title, analysis)


def native_feature_importance(pipeline: Pipeline, fallback_features: list[str], top_n: int) -> list[dict[str, Any]] | dict[str, str]:
    model = pipeline.named_steps["model"]
    features = transformed_feature_names(pipeline, fallback_features)
    values = None
    if hasattr(model, "feature_importances_"):
        values = model.feature_importances_
    elif hasattr(model, "coef_"):
        coef = model.coef_
        values = np.mean(np.abs(coef), axis=0) if len(np.asarray(coef).shape) > 1 else np.abs(coef)
    if values is None:
        return {"error": "Model does not expose native importances or coefficients."}
    rows = sorted([{"feature": features[i] if i < len(features) else f"feature_{i}", "importance": float(value)} for i, value in enumerate(values)], key=lambda row: abs(row["importance"]), reverse=True)[:top_n]
    return safe_json(rows)


def shap_summary(pipeline: Pipeline, X_test: pd.DataFrame, params: dict[str, Any]) -> list[dict[str, Any]] | dict[str, str]:
    try:
        import shap  # type: ignore
    except Exception as exc:
        return {"error": f"SHAP import failed: {exc}"}
    try:
        max_rows = int(params.get("max_rows", 200) or 200)
        top_n = int(params.get("top_n", 20) or 20)
        sample = X_test.head(max_rows)
        transformed = pipeline[:-1].transform(sample)
        model = pipeline.named_steps["model"]
        names = transformed_feature_names(pipeline, X_test.columns.tolist())
        explainer = shap.Explainer(model, transformed)
        values = explainer(transformed)
        arr = np.asarray(values.values)
        if arr.ndim == 3:
            arr = np.mean(np.abs(arr), axis=2)
        mean_abs = np.mean(np.abs(arr), axis=0)
        rows = sorted([{"feature": names[i] if i < len(names) else f"feature_{i}", "mean_abs_shap": value} for i, value in enumerate(mean_abs)], key=lambda row: row["mean_abs_shap"], reverse=True)[:top_n]
        return safe_json(rows)
    except Exception as exc:
        return {"error": f"SHAP failed for this model/data: {exc}"}


def compare_branches(branches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for branch in branches:
        row = {"branch": branch.get("branch"), "model_id": branch.get("model_id"), "task_type": branch.get("task_type")}
        row.update(branch.get("metrics", {}))
        rows.append(row)
    return safe_json(rows)



def merge_node_outputs(target: dict[str, Any], outputs: dict[str, Any], path_index: int | str | None = None, source_label: str | None = None, branch_label: str | None = None) -> None:
    for node_id, output in (outputs or {}).items():
        item = dict(output) if isinstance(output, dict) else json_output(str(node_id), output)
        item.setdefault("node_id", node_id)
        if path_index is not None:
            item.setdefault("path_index", path_index)
        if source_label:
            item.setdefault("source_label", source_label)
        if branch_label:
            item.setdefault("branch", branch_label)
        key = str(node_id)
        if key in target:
            key = f"{node_id}__path_{path_index or len(target)}__{len(target)}"
        target[key] = safe_json(item)

def execute_workflow(graph: dict[str, Any], dataset_df: pd.DataFrame | None, target_column: str | None, task_type: str, run_path: Path) -> dict[str, Any]:
    paths = build_paths(graph)
    if not paths:
        raise ValueError("Workflow is empty.")

    node_map = get_node_map()
    branches: list[dict[str, Any]] = []
    analysis_only: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []

    model_groups: dict[tuple[str, ...], dict[str, Any]] = {}
    analysis_paths: list[tuple[int, list[dict[str, Any]]]] = []

    for index, path in enumerate(paths, start=1):
        model_nodes = [node for node in path if registry_id(node) in MODEL_NODES]
        if not model_nodes:
            analysis_paths.append((index, path))
            continue
        model_node = model_nodes[-1]
        model_index = path.index(model_node)
        key = tuple(node["id"] for node in path[: model_index + 1])
        group = model_groups.setdefault(key, {"path_index": index, "prefix": path[: model_index + 1], "suffix": [], "suffix_seen": set(), "model_node": model_node})
        for node in path[model_index + 1 :]:
            if node["id"] not in group["suffix_seen"]:
                group["suffix"].append(node)
                group["suffix_seen"].add(node["id"])

    for group in model_groups.values():
        try:
            merged_path = group["prefix"] + group["suffix"]
            context = load_context(merged_path, dataset_df, target_column, task_type)
            branch = train_branch(context, group["model_node"], merged_path, run_path)
            branch["path_index"] = group["path_index"]
            branches.append(branch)
        except Exception as exc:
            errors.append({"path_index": str(group["path_index"]), "error": str(exc), "traceback": traceback.format_exc(limit=5)})

    all_node_outputs: dict[str, Any] = {}
    for branch in branches:
        merge_node_outputs(
            all_node_outputs,
            branch.get("node_outputs", {}),
            path_index=branch.get("path_index"),
            source_label=str(branch.get("branch") or ""),
            branch_label=str(branch.get("branch") or ""),
        )

    for index, path in analysis_paths:
        try:
            context = load_context(path, dataset_df, target_column, task_type)
            source = node_label(path[-2]) if len(path) > 1 else f"مسیر {index}"
            merge_node_outputs(all_node_outputs, context.node_outputs, path_index=index, source_label=source)
            analysis_only.append({"path_index": index, "nodes": [node_map.get(registry_id(node), {}).get("label", registry_id(node)) for node in path], "analysis": safe_json(context.analysis), "node_outputs": safe_json(context.node_outputs)})
        except Exception as exc:
            errors.append({"path_index": str(index), "error": str(exc), "traceback": traceback.format_exc(limit=5)})

    if not branches and errors:
        raise ValueError(errors[0]["error"])

    comparison = compare_branches(branches)
    return {"branches": branches, "comparison": comparison, "analysis_only": analysis_only, "node_outputs": safe_json(all_node_outputs), "errors": errors}
