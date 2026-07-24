# Frontend architecture

The frontend is organized by product capability. A feature owns its pages,
components, API client, state helpers, and domain model. Code moves into
`shared` only when at least two features genuinely reuse it.

```text
src/
├── app/                         # Typed URL routing and application composition
├── auth/
│   ├── _service/                # Authentication/profile API
│   └── pages/
│       ├── login/
│       │   └── _components/     # Login-only presentation
│       └── profile/
├── projects/
│   ├── _components/             # Components shared by project pages
│   ├── _service/                # Projects, datasets, artifacts API
│   └── pages/
│       ├── create-project/
│       ├── project-management/
│       └── project-detail/
├── workspace/
│   ├── _components/             # Editors used across workspace pages
│   ├── _hooks/                  # Workspace orchestration hooks
│   ├── _model/                  # Graph/runtime rules and unit tests
│   ├── _service/                # Workflows, runs, components API
│   └── pages/
│       ├── workflow/
│       │   ├── _components/     # Workflow-page shell panels
│       │   ├── _hooks/          # Document, persistence, run and canvas controllers
│       │   ├── _model/          # Page-local pure layout rules and tests
│       │   └── _features/
│       │       ├── boards/      # Board dialogs and UI state
│       │       └── components/  # Component editor/library/model ownership
│       └── board/
│           ├── _components/     # Board cards and controls
│           ├── _hooks/          # Viewport and pointer lifecycle
│           └── _utils/          # Interaction primitives
├── shared/
│   ├── _components/             # Feature-neutral UI primitives
│   ├── _service/                # HTTP transport and session token
│   ├── _types/                  # Cross-feature API contracts
│   └── _utils/                  # Feature-neutral helpers
└── styles/                       # Layered global style system
```

## Dependency rules

- `shared` never imports a product feature.
- `auth` is independent of `projects` and `workspace`.
- Cross-feature calls use another feature's `_service` boundary; features do
  not reach into one another's components or internal model.
- Page-only UI belongs in that page's `_components`; feature-wide UI belongs
  in the feature's `_components`.
- Business and graph rules stay outside React components in `_model` and are
  covered by colocated tests.
- `app` composes features and is the only layer that knows the complete
  application navigation flow. Routes are canonical URLs built on the browser
  History API, so project and workflow pages support refresh and deep links
  without adding a second navigation state.
- The workflow page is an orchestrator. Graph selection, column context,
  analysis boards, run polling, datasets, custom nodes, document persistence,
  version handling, execution, and component lifecycle each own their state in
  focused hooks. Pure graph transformations and layout rules stay in `_model`.
- Shared API contracts are split by domain and re-exported from
  `shared/_types/index.ts` for compatibility.

Run `npm run check:architecture` after moving or adding frontend files. The
check validates relative imports, required folders, retired legacy paths, and
the dependency rules above. It also rejects route pages over 500 lines and
workflow hooks over 450 lines so orchestration cannot silently collapse back
into a god component.
