# IOTA ML frontend architecture

## Goal

The frontend is organized around product capabilities and explicit state boundaries. Compatibility folders (`auth`, `projects`, `workspace`) remain where moving them would create unnecessary route/API risk; new infrastructure and decomposed implementations live under `app`, `features`, `entities`, and `shared`.

```text
src/
├── app/                    # application composition, route parsing, providers, root boundaries
├── features/
│   ├── execution/          # run API, single progress transport and polling policy
│   ├── results/            # output renderers, chart registry, output references
│   ├── workflow/           # workflow API, graph store, parameter editors, node dialog
│   ├── components/         # reusable-component API
│   ├── custom-nodes/       # catalog/custom-node API
│   ├── assistant/          # assistant API
│   └── auth/               # target boundary for subsequent route migration
├── entities/               # stable cross-feature domain models
├── auth/                   # compatible login/profile routes and API facade
├── projects/               # project, dataset and artifact pages/API
├── workspace/              # compatible workflow/Board route composition
├── shared/
│   ├── api/                # the only fetch boundary
│   ├── auth/               # token storage adapter
│   ├── state/              # request deduplication/cache boundary
│   ├── _types/             # exact backend transport DTOs
│   └── _components/        # feature-neutral controls
└── styles/                 # theme, semantic tokens, base, feature sheets, utilities
```

## Application providers

`AppProviders` composes the root error boundary, theme provider and authentication provider. `App.tsx` resolves routes and composes pages; it does not own workflow, execution, chart, Board or dialog internals.

## API boundary

`shared/api/httpClient.ts` is the only module permitted to call `fetch`. It owns:

- API base URL resolution.
- bearer-token injection through `AuthTokenStorage`.
- request timeout and caller cancellation.
- success/error envelope parsing.
- structured `ApiError` and request IDs.
- 204 responses, JSON, uploads and downloads.
- centralized unauthorized notification.

Domain clients are split into auth, projects/datasets/artifacts, workflows, runs, nodes, components and assistant. `workspaceApi` is a temporary compatibility facade only.

## Workflow document

`features/workflow/model/workflowGraphStore.ts` creates a feature-scoped feature-scoped atomic external store. It separates persisted nodes/edges from live React Flow nodes and temporary selection/modal state. Atomic selectors are used by `useWorkflowGraph`; runtime status does not become persisted graph content and drag positions are committed at interaction boundaries.

## Execution

`useRunHistory` is the single owner of the active run and run history. `createRunProgressTransport` guarantees one abortable progress channel per active run, pauses while the tab is hidden, immediately resumes when visible, backs off failures and emits a connection state. The transport interface can be replaced by SSE/WebSocket without changing consumers.

## Results and outputs

The Results panel is registry-driven:

```text
ResultsPanel → OutputCards → OutputCard → OutputRenderer
```

Each output is isolated by an error boundary. Tables, interactive tables, charts, files and generic values are selected by declared output kind rather than one growing conditional component.

Board cards persist an `OutputReference` (`runId`, `nodeId`, `outputId`, optional artifact/revision) plus layout only. Legacy bounded snapshots are read during migration but are not written for new cards. Results, maximize dialogs and Board cards resolve the same current output.

## Chart lifecycle

`features/results/charts/amcharts` owns chart transformation and construction:

- `AmChartsRenderer` owns one root and disposal.
- `chartCore` owns palette, axes, tooltip, legend and resize helpers.
- renderers are separated by chart family.
- delayed frames and `ResizeObserver` are cancelled at unmount.
- hidden outputs are not constructed by Results renderers.

## Parameter and node editing

`ParamEditor` is a bounded registry orchestrator. Field families are in `features/workflow/parameter-editors`. The Node modal composes independent header, inputs, settings and outputs panels and is protected by a feature-level error boundary.

## Reusable components

The previous component-editor controller is split into state, navigation and action hooks. It reuses workflow graph rules rather than maintaining a second page-level graph controller.

## CSS

`theme.css` remains the palette authority. `styles/tokens/semantic.css` maps palette values to semantic surfaces, content, status, spacing, radius, motion and z-index roles. Base document invariants and accessibility/scrollbar utilities are separate. Existing large feature sheets remain for visual compatibility and are guarded by theme/CSS-debt checks while rules are migrated by ownership.

## Enforced boundaries

- `npm run check:architecture` rejects unresolved relative imports, retired roots and oversized route/hook orchestrators.
- `npm run lint` rejects direct fetch, scattered token storage, unsafe TypeScript suppressions and placeholder implementation markers.
- `npm run check:theme` rejects colors, theme variables, shadows and radii outside approved token files.
