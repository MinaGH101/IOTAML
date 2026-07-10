# CSS structure

The previous `src/styles.css` file was split into ordered, contiguous modules.
No selectors, declarations, values, variables, media queries, or rule order were changed.

## Import order

- `00-foundation-workflow.css` — Core tokens, base elements, initial workflow UI, controls, nodes and legacy responsive rules.
- `10-manager-auth-pages.css` — Login, project manager, profile, datasets, history and shared application page styles.
- `20-projects-ai-reference.css` — Projects filters/forms, AI page system, reference layouts and responsive page styles.
- `30-workflow-shell.css` — Workflow topbar, side panels, node palette, quick settings and node modal shell.
- `40-auth-minimal.css` — Final authentication visual design and minimal/reference page refinements.
- `50-workflow-panels-modals.css` — Final workflow layout, tabbed panels, result displays, node modal and fullscreen output.
- `60-analysis-board-custom-nodes.css` — Analysis board, plot/table presentation, light-theme refinements and custom node builder styles.

## Editing rules

1. Keep `src/styles.css` imports in their current order.
2. Edit the module closest to the page or component being changed.
3. Keep deliberate final overrides after the base rules they override.
4. Test both themes and responsive widths after moving any rule between modules.

`src/components/Cubes.css` remains component-scoped and unchanged.
