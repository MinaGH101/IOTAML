# IOTA ML node refactor phase 2

This project version applies the phase-1 class-per-node backend redesign and adds the shared payload layer discussed in chat.

## Main backend design

- `backend/app/nodes/base.py`: BaseNode, ports, settings, node definitions.
- `backend/app/nodes/types.py`: shared payload contracts:
  - `DataFramePayload`: dataframe + `id_column` + metadata
  - `JsonPayload`
  - `ModelPayload`
  - `PlotPayload`
  - `FilePayload`
- `backend/app/nodes/io.py`: shared helpers for reading/writing payloads.
- `backend/app/nodes/<category>/<node>_node.py`: one class per node.

## Implemented phase-2 changes

- CSV input has `ID Column` and `Require Unique ID` settings.
- Dataframe ports now carry `DataFramePayload`, not just a raw dataframe.
- Z-score output shows anomaly rows only, not the full dataframe.
- Z-score anomaly rows include `row_index`, `id_column`, `id_value`, `column`, `value`, `z_score`, `threshold`.
- Missing-values report keeps the dataframe payload and id metadata.
- Conditional Filter supports separate `data` and `criteria` inputs and preserves id metadata when possible.

## Apply

```bash
cd /mnt/e/Desk/no-code-ml-app
docker compose up -d --build
```
