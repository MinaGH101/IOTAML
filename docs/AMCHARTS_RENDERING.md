# amCharts rendering architecture

All interactive scientific plots are rendered by `frontend/src/components/charts/AmChartsOutput.tsx` using amCharts 5.

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
- Plot collections use viewport virtualization. Only the first visible plots and plots close to the scroll viewport have active chart roots.
- Plot-collection charts disable animations, legends, cursors, and pan/zoom interactions.
- Single and maximized plots keep tooltips, zoom cursors, subtle animations, and legends.
- Theme changes are distributed through one shared `MutationObserver`, not one observer per chart.
- Board snapshots keep their original plot payload and render with the same component.

## Theme contract

Chart colors are read from `frontend/src/styles/theme.css` at render time. No independent chart palette is hard-coded outside the theme.

## Licensing

The application preserves amCharts branding unless `VITE_AMCHARTS_LICENSE_KEY` is configured. Set a valid amCharts 5 commercial license key through the root `.env` file when licensed branding removal is required.
