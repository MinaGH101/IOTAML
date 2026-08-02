# State model

## 1. Server state

Server-owned collections and records include users, projects, datasets, workflows, versions, runs, node catalog, components, custom nodes and artifacts. Requests pass through typed domain clients and the shared request cache boundary. Keys are stable tuples such as:

```text
['current-user']
['projects']
['project', projectId]
['datasets', projectId]
['workflows', projectId]
['workflow', workflowId]
['workflow-versions', workflowId]
['runs', projectId]
['run', runId]
['node-catalog']
['components', projectId]
```

The retained lockfile did not permit adding TanStack Query in the reconstruction environment, so the delivered cache implements request deduplication, stale times and invalidation behind `shared/state/serverQuery.tsx`. Its API boundary is intentionally replaceable by TanStack Query without changing domain clients.

## 2. Workflow document state

Persisted document state is nodes, edges, node parameters/names/positions, dataset/task metadata, component instances and Board references. The atomic graph store exposes explicit actions and maintains:

```text
documentNodes   persisted node definitions
liveNodes       React Flow display nodes, including temporary runtime projection
edges           persisted connections
selection       temporary selected node/edge IDs
modal state     temporary open editor ID
revision/dirty  persistence bookkeeping
```

Node runtime status, open panels, chart roots and result payloads are excluded from document serialization.

## 3. Execution runtime state

`useRunHistory` owns the current run, summaries, busy state, last output signature and progress-transport state. Run start/cancel/retry/select-history actions update this boundary only. Node runtime status is projected into live node data and never marks the workflow dirty.

## 4. Output state

Outputs are addressed using:

```ts
type OutputReference = {
  runId: number | null;
  nodeId: string;
  outputId: string;
  artifactId?: number;
  revision?: string;
};
```

Board cards store references and presentation settings. Current run payloads are normalized once for the Results/Board view. Legacy snapshots are supported only as a migration fallback.

## 5. UI state

Selection, open dialogs, panel visibility, active Results/Board tabs, focused output and viewport are UI state. They do not affect autosave signatures unless explicitly part of the persisted product document (for example Board tab metadata).

## Hydration and persistence

1. Catalog aliases normalize historical node IDs.
2. Workflow graph and Board migration functions restore compatible models.
3. Hydration sets the initial save signature and suppresses immediate autosave.
4. Persistent changes produce a canonical signature.
5. Autosave is debounced and serialized through one queue.
6. `base_revision` prevents silent overwrite of a newer backend revision.
7. Version preview pauses autosave and is read-only.
8. Version restore atomically adopts the returned workflow and resets persistence metadata.

## Browser persistence

- `iota-auth-token` is accessed only by the authentication storage adapter.
- `iota-ml-theme` is accessed only during theme bootstrap/provider updates.
- workflow/Board viewport keys are read through `viewportStorage` and are version tolerant.
- saved Board payloads are migrated from legacy snapshots to output references when a current output is available.
