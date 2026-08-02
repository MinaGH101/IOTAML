# amCharts rendering architecture

All interactive scientific plots are rendered by
`frontend/src/workspace/_components/charts/AmChartsOutput.tsx` using amCharts 5.
Tabular results are rendered by the project-owned
`frontend/src/workspace/_components/output/OutputTable.tsx`; MUI is not part of
the frontend runtime.

## Supported output kinds

- `scatter`
- `histogram`
- `bar`
- `line`
- `heatmap`
- `matrix`
- `boxplot`
- `bar_plot`
- `pp_plot`
- `stair_outlier`

The backend output contracts are unchanged. Existing runs, cached artifacts, board snapshots, and reusable components continue to use the same JSON payloads.

## Performance strategy

- The amCharts bundle is loaded with `React.lazy`, so it does not increase the initial workflow-editor load.
- Charts are created imperatively and disposed with `root.dispose()`.
- Every heavy output uses one shared visibility observer and a progressive
  mount scheduler. Only outputs close to the viewport have active chart roots
  or table DOM.
- Plot-collection charts disable animations, legends, cursors, and pan/zoom interactions.
- Single and maximized plots keep tooltips, zoom cursors, subtle animations, and legends.
- Theme changes are distributed through one shared `MutationObserver`, not one observer per chart.
- Board snapshots retain a bounded preview of the original payload and render
  with the same output component. Fresh runs reconnect through a stable output
  key, while persisted rows, plots, points, matrices, series, and strings have
  explicit limits.

## Theme contract

Chart colors are read from `frontend/src/styles/theme.css` at render time. No independent chart palette is hard-coded outside the theme.

## Licensing

The application preserves amCharts branding unless `VITE_AMCHARTS_LICENSE_KEY` is configured. Set a valid amCharts 5 commercial license key through the root `.env` file when licensed branding removal is required.
