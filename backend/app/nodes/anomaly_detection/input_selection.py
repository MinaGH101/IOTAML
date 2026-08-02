"""Resolve one of several connected dataframe sources for anomaly nodes.

The frontend stores the selected upstream node ID in each role setting. Runtime
inputs contain the corresponding source value plus edge metadata. This module
validates the selection and returns its propagated :class:`DataFramePayload`.
"""

from __future__ import annotations

from typing import Any

from app.nodes.io import dataframe_payload
from app.nodes.types import DataFramePayload
from app.workflow.contracts.errors import NodeContractError


def selected_input_dataframe(
    inputs: dict[str, Any],
    source_node_id: Any,
    role_label: str,
) -> DataFramePayload:
    """Return the connected dataframe selected for one anomaly role.

    Raises a user-facing ``ValueError`` when the setting is empty, the source is
    no longer connected, or its selected output handle is not a dataframe.
    """
    source_id = str(source_node_id or "").strip()
    if not source_id:
        raise NodeContractError(
            "ANOMALY_SOURCE_NOT_SELECTED",
            f"Select the connected dataframe to use for {role_label}.",
            category="setting",
            setting="calculation_source" if "calculation" in role_label else "detection_source",
            expected="an upstream node ID",
            actual=source_node_id,
            suggested_fix="Open anomaly settings and select one of the connected dataframes.",
        )

    connected_sources = {
        str(edge.get("source") or "")
        for edge in inputs.get("_edges", [])
        if isinstance(edge, dict) and str(edge.get("targetHandle") or "") == "data"
    }
    if source_id not in connected_sources:
        raise NodeContractError(
            "ANOMALY_SOURCE_NOT_CONNECTED",
            f"The selected dataframe for {role_label} is not connected to this node.",
            category="input",
            port="data",
            expected=sorted(connected_sources),
            actual=source_id,
            suggested_fix="Reconnect that source or select a dataframe that is currently connected.",
        )

    payload = dataframe_payload({"selected": inputs.get(source_id)})
    if payload is None:
        raise NodeContractError(
            "ANOMALY_SOURCE_HAS_NO_DATAFRAME",
            f"The selected upstream node for {role_label} has no dataframe output. "
            "Run or connect a dataframe-producing node.",
            category="input",
            port="data",
            expected="dataframe output",
            actual=source_id,
            suggested_fix="Connect the dataframe output handle, then run the upstream node.",
        )
    if payload.df is None or len(payload.df.columns) == 0:
        raise NodeContractError(
            "ANOMALY_SOURCE_HAS_NO_COLUMNS",
            f"The selected upstream dataframe for {role_label} has no columns.",
            category="data",
            port="data",
            expected="at least one calculation column",
            actual=[],
            suggested_fix="Select a source whose dataframe contains columns.",
        )
    return payload
