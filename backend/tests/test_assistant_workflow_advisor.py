"""Regression tests for context-aware assistant workflow advice."""

from app.domains.assistant.workflow_advisor import advise_workflow


def test_classification_advice_marks_existing_nodes_and_connection_source() -> None:
    current_workflow = {
        "nodes": [
            {
                "instanceId": "csv-1",
                "registryId": "DI-002",
                "label": "Upload CSV/Excel",
                "typeLabel": "Upload CSV/Excel",
                "category": "Data Input",
                "outputTypes": ["dataframe"],
            },
            {
                "instanceId": "select-1",
                "registryId": "CL-006",
                "label": "Select Rows / Columns",
                "typeLabel": "Select Rows / Columns",
                "category": "Data Cleaning",
                "outputTypes": ["dataframe"],
            },
            {
                "instanceId": "replace-1",
                "registryId": "CL-008",
                "label": "Replace Values",
                "typeLabel": "Replace Values",
                "category": "Data Cleaning",
                "outputTypes": ["dataframe"],
            },
            {
                "instanceId": "dl-1",
                "registryId": "CL-010",
                "label": "Detection Limit Handling",
                "typeLabel": "Detection Limit Handling",
                "category": "Data Cleaning",
                "outputTypes": ["dataframe"],
            },
        ],
        "summary": {
            "preferredDataframeSourceNodeIds": ["dl-1", "replace-1", "select-1", "csv-1"],
            "dataframeEndpointNodeIds": ["dl-1"],
            "dataframeNodeIds": ["csv-1", "select-1", "replace-1", "dl-1"],
        },
    }

    result = advise_workflow(
        "می‌خوام یک مدل ml آموزش بدم",
        pattern_id="classification",
        current_workflow=current_workflow,
    )

    pattern = result["patterns"][0]
    steps = {step["id"]: step for step in pattern["steps"]}

    assert steps["load_data"]["alreadyPresent"] is True
    assert steps["select_features_target"]["alreadyPresent"] is False

    connection_advice = pattern["connectionAdvice"]
    assert connection_advice["recommendedSourceNodeId"] == "dl-1"
    assert connection_advice["connectToStepId"] == "select_features_target"

    action_plan = pattern["actionPlan"]
    assert action_plan["mode"] == "dry_run"
    assert action_plan["alreadyPresent"][0]["instanceId"] == "csv-1"
    assert action_plan["add"][0]["stepId"] == "select_features_target"
    assert action_plan["connect"][0]["sourceNodeId"] == "dl-1"
    assert action_plan["connect"][0]["targetStepId"] == "select_features_target"


def test_visualization_nodes_are_not_needed_for_ml_connection_source() -> None:
    current_workflow = {
        "nodes": [
            {
                "instanceId": "dl-1",
                "registryId": "CL-010",
                "label": "Detection Limit Handling",
                "typeLabel": "Detection Limit Handling",
                "category": "Data Cleaning",
                "outputTypes": ["dataframe"],
            },
            {
                "instanceId": "hist-1",
                "registryId": "VZ-002",
                "label": "Histogram",
                "typeLabel": "Histogram",
                "category": "Visualizations",
                "outputTypes": ["plot"],
            },
        ],
        "summary": {
            "preferredDataframeSourceNodeIds": ["dl-1"],
            "dataframeEndpointNodeIds": ["dl-1"],
            "dataframeNodeIds": ["dl-1"],
            "visualizationNodeIds": ["hist-1"],
        },
    }

    result = advise_workflow(
        "آموزش مدل classification",
        pattern_id="classification",
        current_workflow=current_workflow,
    )

    connection_advice = result["patterns"][0]["connectionAdvice"]
    action_plan = result["patterns"][0]["actionPlan"]

    assert connection_advice["recommendedSourceNodeId"] == "dl-1"
    assert connection_advice["recommendedSourceName"] == "Detection Limit Handling"
    assert action_plan["connect"][0]["sourceNodeId"] == "dl-1"


def test_cleaning_goal_uses_cleaning_pattern_not_outlier_detection() -> None:
    result = advise_workflow("یک جریان برای پاکسازی داده بساز")

    pattern = result["patterns"][0]
    assert pattern["id"] == "data_cleaning"

    planned_node_names = {
        item["nodeName"]
        for item in pattern["actionPlan"]["add"]
    }
    assert "IQR Anomaly Detector" not in planned_node_names
    assert "Select Rows / Columns" in planned_node_names
    assert "Replace Values" in planned_node_names
    assert "Imputation" in planned_node_names
