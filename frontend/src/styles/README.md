# IOTA CSS architecture

`styles.css` is the only global entry loaded by `main.tsx`. It contains theme tokens, document defaults, loading/error utilities and accessibility/scrollbar rules only.

Feature CSS is lazy-loaded with its route:

- `auth/styles/auth.css` — login/profile
- `projects/styles/projects.css` — project management/create/detail
- `admin/styles/admin.css` — admin
- `workspace/styles/workspace.css` — workflow/board/results/node UI
- `shared/ui/ui.module.css` — reusable UI primitives; loaded only when a shared UI component is imported

The `*/styles/stages/` files preserve the old cascade order while separating ownership. `shared/styles/stages/` contains only cross-feature legacy rules and is imported by each route bundle in the same stage order.

Rules for maintenance:

1. New generic control styling belongs in `shared/ui/ui.module.css`, not a feature stylesheet.
2. New feature-only styles belong in that feature's `styles/` folder.
3. Do not add feature styles back to `styles.css`.
4. Keep vendor/runtime selectors such as `.react-flow__*` in workspace styles.
5. When a legacy rule is replaced by a CSS Module/shared UI primitive, delete the legacy rule rather than overriding it.
