# Dataframe utility nodes

## Combine DataFrames (`UT-003`)

This node appears in the **Data Cleaning** palette section and accepts two or
more connections on one repeatable `data` port.

Vertical / row combination:

- `match`: column names and order must be identical.
- `union`: all columns are retained and absent values are empty.
- `intersection`: only common columns are retained.

Horizontal / column combination:

- `id`: every input must contain the chosen ID column; IDs must be non-empty
  and unique. `inner`, `outer`, and `left` joins are supported.
- `position`: all inputs must contain the same number of rows.
- duplicate non-ID column names either fail or receive deterministic input
  suffixes.

There is no implicit fallback between these strategies. Invalid shapes fail
before a partial output is produced.

## Interactive Table (`UT-008`)

This node appears in the **Data Cleaning** palette section.

The source dataframe remains authoritative. The node stores an operation state
in its parameters:

- cell edits keyed by stable source/addition row keys;
- added row values;
- added column definitions;
- selected rows and selected columns.

The frontend editor supports cell editing, row/column creation, multi-selection,
sorting, changed-cell highlighting, and previous-value tooltips. The backend
replays the persisted state on each run and emits:

1. an interactive editor output containing current and original values;
2. a clean dataframe output containing the applied changes and active
   row/column selection.

The clean dataframe port is the value consumed by downstream nodes. Re-running
the selected node propagates the latest persisted editor state.

All source rows and columns are selected the first time the editor is opened.
The row and column controls use the same select-all/deselect-all toggle as
column multiselect settings elsewhere in the application. An explicit empty
selection is preserved as empty; it is not confused with an uninitialized
legacy state.

Workspace, node modal, and Analysis Board subscribe to one node-scoped runtime
state. Cell edits and selections update the linked clean-result table
immediately in every mounted view. Only subscribers for that node rerender.
Workflow-parameter persistence is debounced by 180 ms, so typing does not
trigger a full graph update and autosave for every keypress. Downstream backend
nodes still require a run because their dataframe values are computed by the
workflow executor.

The editor uses an operation log instead of storing a duplicate copy of the
upstream dataframe in the workflow document. The editable row limit is explicit
and validation fails with `INTERACTIVE_TABLE_ROW_LIMIT` when exceeded.

Persisted editor state is normalized before rendering. React state commits do
not trigger workflow mutations from inside state-updater callbacks, and the
shared output boundary converts any unexpected renderer exception into an
actionable application-error card instead of blanking the workspace.
