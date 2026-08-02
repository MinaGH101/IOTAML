# Testing and validation

## Commands

```bash
npm ci
npm run lint
npm run typecheck
npm run lint:css
npm run check:architecture
npm run check:theme
npm run check:css-debt
npm run test
npm run test:contracts
npm run test:e2e
npm run build
npm run check
```

## Model tests

`npm run test` discovers all `src/**/*.test.ts` files and runs them with Node's TypeScript stripping. Coverage includes graph normalization, column context, component boundaries, Board resolution, output snapshots/references, interactive-table state, runtime merging, viewport persistence, workflow persistence, component graph logic and adaptive polling policy.

## Contract suites

The dependency-free contract suites verify:

- only the shared HTTP boundary owns network behavior.
- root error recovery exists.
- Board creation persists references rather than snapshots.
- decomposed monoliths stay below enforced budgets.
- production Nginx keeps SPA/API/SSE behavior.

## Browser suite status

`playwright.config.ts` reserves the standard browser test location. Playwright, Vitest, Testing Library and MSW were not added because the supplied lockfile and available package registry could not resolve new packages during this reconstruction. `npm run test:e2e` therefore executes deployment contract tests, not a browser session. Add the browser stack in a controlled lockfile refresh before treating responsive screenshots and full interaction flows as automated acceptance.

## Manual production checklist

Test login/profile upload, projects, dataset upload, workflow load/edit, node modal and selectors, run all/selected, cancel/retry/history, every output renderer, maximize/export, Board pin/move/resize, interactive edits, autosave/version restore, reusable components, custom nodes, theme, reload persistence and required responsive sizes.
