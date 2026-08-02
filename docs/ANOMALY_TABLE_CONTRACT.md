# Anomaly dataframe and table contract

The Z-score (`AD-001`), IQR (`AD-003`), and manual-threshold (`AD-004`) nodes
have one repeatable dataframe input and exactly three dataframe outputs.

| Port | Backend value | Frontend representation |
| --- | --- | --- |
| `thresholds` | Dataframe containing the calculated class boundaries for each selected variable | Threshold table |
| `anomalies` | Long dataframe containing class, variable, sample, and detection-frame value | One table card with class tabs |
| `counts` | Wide dataframe with one row per anomaly class and one count column per variable | Count table suitable for a bar plot |

There is no anomaly `report` JSON port and no additional flagged-data output.
Every visible anomaly output has `kind: "table"`. The frontend treats any
non-table value received for one of these roles as
`ANOMALY_OUTPUT_CONTRACT_MISMATCH`, identifies it as an application problem,
and does not silently render the malformed value as JSON.

## Dual-dataframe selection

Both source selectors contain only dataframe-producing nodes currently
connected to the anomaly node:

- the calculation source determines class membership and thresholds;
- the detection source supplies the reported sample values;
- selected calculation columns map to detection columns using the shared
  canonical column-name rule;
- the same source may be selected for both roles;
- an ID is used for cross-dataframe alignment only when it is explicit, present
  in both frames, non-empty, and unique;
- the sample column is not declared as the anomaly dataframe ID because one
  sample may occur in multiple variables or classes.

Disconnected sources, missing columns, ambiguous canonical matches, invalid
settings, and unsafe ID alignment fail immediately through the shared
`WorkflowProblem` error structure.

## Source of truth

- Backend display/dataframe adapter:
  `app/nodes/anomaly_detection/output_contract.py`
- Shared detector:
  `app/nodes/anomaly_detection/anomalies.py`
- Source selector:
  `app/nodes/anomaly_detection/input_selection.py`
- Frontend table and tab renderer:
  `frontend/src/workspace/_components/ResultsPanel.tsx`
