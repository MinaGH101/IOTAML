import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import { memo, useEffect, useRef, useSyncExternalStore } from 'react';
import type { Output } from '../../../../workspace/_model/output';
import { chartHeight } from '../../../../workspace/_components/charts/chartSizing';
import { getThemeSnapshot, subscribeTheme } from '../../../../workspace/_components/charts/chartTheme';
import { createRoot, themePalette } from './chartCore';
import { renderScatter } from './renderers/scatter';
import { renderHistogram } from './renderers/histogram';
import { renderHorizontalBar, renderLearningCurve } from './renderers/series';
import { renderBarPlot } from './renderers/barPlot';
import { renderHeatmap } from './renderers/heatmap';
import { renderBoxPlot, renderStairOutlier } from './renderers/distribution';

export type AmChartsRendererProps = {
  output: Output;
  collectionMode?: boolean;
  fillContainer?: boolean;
};

type RenderChart = (root: am5.Root, output: Output, palette: ReturnType<typeof themePalette>, compact: boolean) => am5xy.XYChart | false;

const chartRegistry: Record<string, RenderChart> = {
  scatter: renderScatter,
  pp_plot: (root, output, palette, compact) => renderScatter(root, output, palette, compact, true),
  histogram: renderHistogram,
  bar: renderHorizontalBar,
  line: renderLearningCurve,
  bar_plot: renderBarPlot,
  heatmap: renderHeatmap,
  matrix: renderHeatmap,
  boxplot: renderBoxPlot,
  stair_outlier: renderStairOutlier,
};

const AmChartsRenderer = memo(function AmChartsRenderer({ output, collectionMode = false, fillContainer = false }: AmChartsRendererProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const themeKey = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeSnapshot);
  const kind = String(output.kind || 'plot');
  const height = chartHeight(output);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let root: am5.Root | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame = 0;
    let firstMountFrame = 0;
    let secondMountFrame = 0;
    element.dataset.chartError = '';

    firstMountFrame = window.requestAnimationFrame(() => {
      secondMountFrame = window.requestAnimationFrame(() => {
        if (!element.isConnected) return;
        const palette = themePalette();
        root = createRoot(element, palette, !collectionMode);
        try {
          const chart = chartRegistry[kind]?.(root, output, palette, collectionMode) || false;
          if (chart && !collectionMode) chart.appear(420, 40);
        } catch (error) {
          console.error(`amCharts render failed for ${kind}`, error);
          element.dataset.chartError = 'true';
        }
        resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
          if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
          resizeFrame = window.requestAnimationFrame(() => root?.resize());
        });
        resizeObserver?.observe(element);
        resizeFrame = window.requestAnimationFrame(() => root?.resize());
      });
    });

    return () => {
      resizeObserver?.disconnect();
      if (firstMountFrame) window.cancelAnimationFrame(firstMountFrame);
      if (secondMountFrame) window.cancelAnimationFrame(secondMountFrame);
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      root?.dispose();
    };
  }, [collectionMode, fillContainer, kind, output, themeKey]);

  return (
    <div className={`amchart-wrap ${fillContainer ? 'amchart-wrap-fill' : ''}`} style={{ height: fillContainer ? '100%' : height }} data-chart-kind={kind} data-theme-key={themeKey}>
      <div ref={ref} className="amchart-canvas" role="img" aria-label={String(output.title || kind)} />
    </div>
  );
});

export default AmChartsRenderer;
