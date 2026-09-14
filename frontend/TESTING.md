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

## Real browser regression

The Playwright test in `tests/e2e/workflow.spec.ts` signs in, uploads a CSV through the UI, checks all four new nodes in the palette, trains a selected node and its ancestors, saves a named version, and reopens the workflow. The API prepares a deterministic graph and verifies persisted state; API responses are not mocked. Test projects are removed in a finally block.

Start the development stack and restart the worker after changing backend code. Install browser dependencies on a supported host:

```bash
npm ci
npx playwright install --with-deps chromium
```

Create a temporary account without using anyone's existing password (run from the repository root):

```bash
docker compose exec -T api python -m scripts.e2e_account create > frontend/.e2e-credentials.json
```

Alternatively set `E2E_USERNAME` and `E2E_PASSWORD` for a test-only account with project creation permission. Configure `PLAYWRIGHT_BASE_URL` for the frontend and `PLAYWRIGHT_API_URL` for the API; the browser must also reach the frontend's `VITE_API_URL`. On the default desktop stack these are `http://localhost:5174` and `http://localhost:8001`.

```bash
cd frontend
PLAYWRIGHT_BASE_URL=http://localhost:5174 PLAYWRIGHT_API_URL=http://localhost:8001 npm run test:e2e
```

For Alpine containers, install `chromium` using apk and set `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser`. A browser inside a container needs container-reachable frontend/API addresses. A separate Vite server can be started with `VITE_API_URL=http://api:8000 npm run dev -- --port 5174`.

After testing, delete the temporary account from the repository root:

```bash
docker compose exec -T api python -m scripts.e2e_account delete < frontend/.e2e-credentials.json
rm frontend/.e2e-credentials.json
```

Cleanup refuses non-test usernames or users with remaining projects. Credentials, traces and screenshots are gitignored. Failed traces can contain application data; keep them local. Run `npm run test:deployment` for the separate static Nginx checks. `npm run check` covers unit/contract tests and the production build; the browser suite requires the running stack and is a separate command.

The optional SQL test uses a temporary PostgreSQL schema and removes it afterward:

```bash
TEST_SQL_DATABASE_URL=postgresql+psycopg2://... pytest -q tests/test_sql_import_integration.py
```

## Manual production checklist

Test login/profile upload, projects, dataset upload, workflow load/edit, node modal and selectors, run all/selected, cancel/retry/history, every output renderer, maximize/export, Board pin/move/resize, interactive edits, autosave/version restore, reusable components, custom nodes, theme, reload persistence and required responsive sizes.
