# Performance model and budgets

## Removed high-cost coupling

- Workflow route composition is separated from graph, persistence, execution, Board, dialog and result internals.
- Runtime node status is projected separately from persisted graph state.
- Board cards persist output references, not dataframe/chart payload copies.
- Result renderer and chart construction are registry based and isolated by output.
- One progress transport serves header, nodes, history and Results state.
- viewport persistence and node-position commits occur at controlled interaction boundaries.

## Chart lifecycle

Each mounted amCharts output owns exactly one root. The lifecycle cancels queued animation frames, disconnects its observer and disposes the root. Chart family adapters are pure modules. Board resize uses container observation instead of rebuilding the complete Results tree.

## Polling

```text
queued:             1600 ms
running:             900 ms
failure backoff:    1800 → 3600 → 7200 → 10000 ms
hidden document:    paused
terminal run:       closed
active channels:    1 per active run
```

Identical polling errors are not repeatedly shown.

## Output and Board budgets

- Board persisted payload: reference + layout only for new cards.
- legacy snapshot fallback: bounded by existing snapshot migration limits.
- table preview: existing row limits remain; large table virtualization is a documented follow-up.
- mounted hidden charts: zero in the Results registry path.
- removed Board cards: no retained output copy.
- historical run selection: one active full-run object.

## Rendering budgets

- route composition component: under 80 lines.
- parameter orchestrator: under 260 lines.
- node-dialog orchestrator: under 180 lines.
- component-editor composition hook: under 300 lines.
- chart renderer family: independently mounted and disposed.

These are enforced by `npm run lint`, architecture checks and performance contract tests.

## Bundle strategy

Profile, project creation/detail/management and Workflow routes are lazy loaded. The Workflow route is therefore excluded from login’s initial route code. amCharts remains isolated behind chart output modules; the Vite build keeps dedicated React Flow and amCharts vendor groups.

## Profiling

Use Chrome Performance/Memory and React Profiler for:

1. 20 switches between Workflow and Board.
2. 20 chart maximize/open-close cycles.
3. a node drag followed by idle autosave.
4. one running workflow with DevTools Network open.
5. repeated Board card resize.

Expected behavior: one run progress request chain, no detached amCharts roots, no continuous idle animation, and no autosave per pointer-move event.
