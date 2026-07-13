# CSS and theme structure

The application CSS is split by feature, while every visual theme decision is centralized in `theme.css`.

## Theme file

Edit `src/styles/theme.css` to change the application appearance.

The first two blocks are the main controls:

- `:root, :root[data-theme="dark"]` — dark-mode colors.
- `:root[data-theme="light"]` — light-mode colors.

The shared `:root` block contains:

- typography
- radii
- border widths
- motion
- responsive spacing
- compatibility color tokens

The final section applies the visual hierarchy: major surfaces, modal columns, fields, tables, buttons, and icon controls.

## Design rules

- Use semantic variables from `theme.css`; do not add direct hex, RGB, or HSL values to feature CSS.
- Define new custom properties in `theme.css`, not in component files.
- Use radius variables instead of numeric `border-radius` values.
- Shadows, glows, and backdrop blur are intentionally disabled.
- Icon-only controls stay transparent and borderless; hover changes only their color.
- Use borders only for major region boundaries or necessary separators.

## Feature modules

- `00-foundation-workflow.css` — base elements and workflow foundations.
- `10-manager-auth-pages.css` — manager, project, profile, and shared page rules.
- `20-projects-ai-reference.css` — project/reference layouts.
- `30-workflow-shell.css` — workflow shell and node palette.
- `40-auth-minimal.css` — authentication layouts.
- `50-workflow-panels-modals.css` — workflow panels and node modal structure.
- `60-analysis-board-custom-nodes.css` — analysis board, result views, and custom nodes.
- `theme.css` — all colors, theme radii, visual states, and final theme behavior.

Run `npm run check:theme` after CSS changes. It rejects raw colors, component-level custom-property declarations, raw radii, shadows, and active backdrop blur outside `theme.css`.
