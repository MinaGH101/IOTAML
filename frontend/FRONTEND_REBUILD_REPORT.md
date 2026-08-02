# Frontend rebuild report

## Scope inspected

The complete supplied repository was extracted and the frontend/backend contract surfaces were inspected before changes. Inventory covered routes, API clients, shared DTOs, local-storage access, workflow/Board serialization, node catalog parameters, output renderers, run progress and production deployment.

## Original concentration points

```text
ParamEditor.tsx                 ~45 KB
AmChartsOutput.tsx              ~34 KB
ResultsPanel.tsx                ~23 KB
NodeModal.tsx                   ~16 KB
WorkflowPage.tsx                ~16 KB
useComponentEditor.ts           ~15 KB
```

Large accumulated global CSS feature sheets were also retained as a known migration area to avoid visual contract breakage.

## Main reconstruction

- Added root providers and recoverable application/workflow/output boundaries.
- Isolated token persistence and unauthorized handling.
- Replaced the minimal fetch wrapper with a typed, abortable domain transport.
- Split workflow, run, node, component and assistant clients.
- Added a normalized feature-scoped workflow graph store.
- Reduced `WorkflowPage` to route composition and split the component editor controller.
- Replaced Results conditional growth with an output renderer registry.
- Split amCharts by lifecycle/core/chart-family renderers.
- Split parameter field families and Node dialog panels.
- Replaced new Board payload snapshots with stable output references and added legacy migration.
- Replaced page polling with one adaptive visibility-aware run transport.
- Added semantic theme/token/base/accessibility/scrollbar layers.
- Added source, architecture, theme, CSS-debt, contract and deployment checks.
- Hardened Docker/Nginx caching, security, uploads, API, SSE and WebSocket behavior.

## Compatibility decisions

- Existing route hierarchy and backend paths are preserved.
- `workspaceApi` remains as a facade while feature hooks migrate to domain clients.
- existing auth/theme/viewport keys remain readable.
- legacy Board snapshots remain readable but new cards write references only.
- backend graph field names and `base_revision` behavior remain unchanged.
- existing visual feature CSS remains in the cascade to prevent an unrelated redesign.

## Dependency changes

No new runtime dependency was required. The workflow graph uses a small React `useSyncExternalStore` adapter with atomic selectors, avoiding a second global state framework and preserving the supplied lockfile.

## Validation completed in this environment

Passed:

```text
check:architecture
lint
check:theme
source model tests (6)
contract tests (7)
deployment contract tests (2)
```

## Validation limitation

A clean `npm ci`, TypeScript build, Stylelint execution and complete existing test suite could not be run because this execution environment could not resolve required npm tarballs from its package registry and had no usable installed `node_modules`. No build success is claimed. The delivered package manifest and lockfile remain synchronized for the existing dependency set, but the archive must be validated with normal npm registry access before production deployment.

## Known limitations

- The retained server-query cache is not TanStack Query; a lockfile-safe dependency refresh is still required.
- Playwright/Vitest/Testing Library/MSW browser and component suites are documented but not installed.
- Existing large CSS feature sheets are guarded and layered, not fully rewritten into per-component modules.
- Existing table rendering remains the compatibility implementation; a full virtualized table replacement was not completed.
- SSE/WebSocket proxy and transport boundary exist, while the current backend still uses polling.

## Replacement

The archive contains one top-level `frontend/` directory and excludes `node_modules`, `dist`, `.git`, real environment values, coverage and browser binaries.
