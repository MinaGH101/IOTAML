# Dataframe contract v3

Each dataframe port carries:

- one active dataframe containing the selected ID first plus calculation
  columns;
- an immutable lineage reference shared across downstream in-memory payloads;
- explicit source row-position keys;
- active/source column names and public metadata.

ID columns never appear in `calculation_columns()`. ID selectors use source
column metadata, and switching IDs materializes only the selected source series
for the current row keys. Filtering and sorting map rows by a unique workflow ID
or preserved index. Length-only alignment is forbidden. Aggregating nodes must
set `reset_lineage=True`.

Dataset-backed lineages retain the durable materialized dataset path. Their
source frame is omitted when a node result is serialized and loaded lazily only
if a later node switches to an original source column. Synthetic lineages keep
an in-memory fallback because they have no durable source artifact. Thus normal
downstream cache entries contain the active frame, row keys, schema, and source
reference—not another complete copy of the uploaded dataset.

The executor applies the contract once to every fresh node result, including
each declared output port. Cached values are already normalized; cache format
`iota-node-cache-v3` prevents older embedded-source payloads from being reused.

Relevant regression and benchmark coverage is in
`backend/tests/test_dataframe_contract.py`.
