import * as am5 from '@amcharts/amcharts5';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import * as am5xy from '@amcharts/amcharts5/xy';
import { memo, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { Output } from '../ResultsPanel';

const amChartsLicenseKey = String(import.meta.env.VITE_AMCHARTS_LICENSE_KEY || '').trim();
if (amChartsLicenseKey) am5.addLicense(amChartsLicenseKey);

type ChartPalette = {
  text: string;
  muted: string;
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  panel: string;
  control: string;
  font: string;
};

type Props = {
  output: Output;
  collectionMode?: boolean;
};

const themeListeners = new Set<() => void>();
let themeObserver: MutationObserver | null = null;

function getThemeSnapshot() {
  return document.documentElement.dataset.theme || 'dark';
}

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  if (!themeObserver) {
    themeObserver = new MutationObserver(() => themeListeners.forEach((callback) => callback()));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  return () => {
    themeListeners.delete(listener);
    if (themeListeners.size === 0 && themeObserver) {
      themeObserver.disconnect();
      themeObserver = null;
    }
  };
}

function themePalette(): ChartPalette {
  const styles = getComputedStyle(document.documentElement);
  const value = (name: string) => styles.getPropertyValue(name).trim();
  return {
    text: value('--theme-text'),
    muted: value('--theme-text-muted'),
    primary: value('--theme-primary'),
    secondary: value('--theme-secondary'),
    success: value('--theme-success'),
    warning: value('--theme-warning'),
    danger: value('--theme-danger'),
    panel: value('--theme-popup-bg'),
    control: value('--theme-control-bg'),
    font: value('--theme-font-family'),
  };
}

function resolveColor(raw: unknown, fallback: string, palette: ChartPalette) {
  const source = String(raw || '').trim();
  if (!source) return fallback;
  const variable = source.match(/^var\((--[^,)]+)/)?.[1];
  if (variable) return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
  if (source === 'primary') return palette.primary;
  if (source === 'secondary') return palette.secondary;
  if (source === 'success') return palette.success;
  if (source === 'warning') return palette.warning;
  if (source === 'danger') return palette.danger;
  return source;
}

function finite(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function formatNumber(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  if (Math.abs(number) >= 1000) return number.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return number.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function createRoot(element: HTMLDivElement, palette: ChartPalette, animated: boolean) {
  const root = am5.Root.new(element);
  if (animated) root.setThemes([am5themes_Animated.new(root)]);
  root.numberFormatter.set('numberFormat', '#,###.####');
  return root;
}

function createChart(root: am5.Root, compact: boolean) {
  return root.container.children.push(am5xy.XYChart.new(root, {
    panX: !compact,
    panY: false,
    wheelX: !compact ? 'panX' : 'none',
    wheelY: !compact ? 'zoomX' : 'none',
    pinchZoomX: !compact,
    paddingTop: compact ? 12 : 20,
    paddingRight: 14,
    paddingBottom: 8,
    paddingLeft: 8,
  }));
}

function styleAxisRenderer(renderer: any, palette: ChartPalette, labelRotation = 0) {
  renderer.grid.template.setAll({
    stroke: am5.color(palette.muted),
    strokeOpacity: 0.16,
    strokeDasharray: [3, 4],
  });
  renderer.ticks.template.setAll({
    visible: true,
    stroke: am5.color(palette.muted),
    strokeOpacity: 0.3,
    length: 4,
  });
  renderer.labels.template.setAll({
    fill: am5.color(palette.muted),
    fontSize: 11,
    fontFamily: palette.font,
    rotation: labelRotation,
    oversizedBehavior: 'truncate',
    maxWidth: 140,
  });
}

function addAxisLabel(root: am5.Root, axis: any, text: string, vertical: boolean, palette: ChartPalette) {
  if (!text) return;
  axis.children.push(am5.Label.new(root, vertical ? {
    text,
    rotation: -90,
    y: am5.p50,
    centerX: am5.p50,
    fill: am5.color(palette.muted),
    fontSize: 11,
    fontFamily: palette.font,
  } : {
    text,
    x: am5.p50,
    centerX: am5.p50,
    fill: am5.color(palette.muted),
    fontSize: 11,
    fontFamily: palette.font,
    paddingTop: 8,
  }));
}

function makeTooltip(root: am5.Root, palette: ChartPalette, labelText: string) {
  const tooltip = am5.Tooltip.new(root, {
    labelText,
    getFillFromSprite: false,
    getStrokeFromSprite: false,
  });
  tooltip.get('background')?.setAll({
    fill: am5.color(palette.panel),
    fillOpacity: 0.96,
    stroke: am5.color(palette.muted),
    strokeOpacity: 0.32,
  });
  tooltip.label.setAll({ fill: am5.color(palette.text), fontSize: 11, fontFamily: palette.font });
  return tooltip;
}

function addCursor(root: am5.Root, chart: am5xy.XYChart, compact: boolean, palette: ChartPalette) {
  if (compact) return;
  const cursor = chart.set('cursor', am5xy.XYCursor.new(root, { behavior: 'zoomX' }));
  cursor.lineX.setAll({ stroke: am5.color(palette.muted), strokeOpacity: 0.38 });
  cursor.lineY.setAll({ stroke: am5.color(palette.muted), strokeOpacity: 0.24 });
}

function addLegend(root: am5.Root, chart: am5xy.XYChart, palette: ChartPalette, compact: boolean) {
  if (chart.series.length < 2 || compact) return;
  const legend = chart.children.push(am5.Legend.new(root, {
    centerX: am5.p50,
    x: am5.p50,
    layout: root.horizontalLayout,
    marginTop: 8,
  }));
  legend.labels.template.setAll({ fill: am5.color(palette.muted), fontSize: 10, fontFamily: palette.font });
  legend.valueLabels.template.set('forceHidden', true);
  legend.markerRectangles.template.setAll({ cornerRadiusTL: 4, cornerRadiusTR: 4, cornerRadiusBL: 4, cornerRadiusBR: 4 });
  legend.data.setAll(chart.series.values);
}

function addValueRange(root: am5.Root, axis: any, value: number, label: string, color: string, palette: ChartPalette) {
  const dataItem = axis.makeDataItem({ value });
  const range = axis.createAxisRange(dataItem);
  range.get('grid')?.setAll({
    visible: true,
    stroke: am5.color(color),
    strokeWidth: 1.5,
    strokeOpacity: 0.9,
    strokeDasharray: [7, 5],
  });
  range.get('label')?.setAll({
    text: `${label} · ${formatNumber(value)}`,
    fill: am5.color(color),
    background: am5.RoundedRectangle.new(root, {
      fill: am5.color(palette.panel),
      fillOpacity: 0.86,
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      cornerRadiusBL: 4,
      cornerRadiusBR: 4,
    }),
    fontSize: 10,
    paddingLeft: 5,
    paddingRight: 5,
    inside: true,
  });
}

function addCircleBullets(root: am5.Root, series: any, color: string, radius: number, strokeColor: string) {
  series.bullets.push(() => am5.Bullet.new(root, {
    sprite: am5.Circle.new(root, {
      radius,
      fill: am5.color(color),
      fillOpacity: 0.9,
      stroke: am5.color(strokeColor),
      strokeOpacity: 0.72,
      strokeWidth: 1,
    }),
  }));
}

function renderScatter(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean, pp = false) {
  const points = ((output.points as Record<string, unknown>[] | undefined) || (output.rows as Record<string, unknown>[] | undefined) || []);
  const xKey = String(output.x || (pp ? 'theoretical_probability' : 'x'));
  const yKey = String(output.y || (pp ? 'observed_probability' : 'y'));
  const data = points.map((point) => ({ x: Number(point[xKey]), y: Number(point[yKey]) })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!data.length) return false;

  const chart = createChart(root, compact);
  const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 52 });
  const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 38 });
  styleAxisRenderer(xRenderer, palette);
  styleAxisRenderer(yRenderer, palette);
  const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
    renderer: xRenderer,
    min: pp ? 0 : finite(output.x_min),
    max: pp ? 1 : finite(output.x_max),
    strictMinMax: pp || finite(output.x_min) !== undefined || finite(output.x_max) !== undefined,
    extraMin: pp ? 0 : 0.04,
    extraMax: pp ? 0 : 0.04,
  }));
  const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
    renderer: yRenderer,
    min: pp ? 0 : finite(output.y_min),
    max: pp ? 1 : finite(output.y_max),
    strictMinMax: pp || finite(output.y_min) !== undefined || finite(output.y_max) !== undefined,
    extraMin: pp ? 0 : 0.04,
    extraMax: pp ? 0 : 0.04,
  }));
  addAxisLabel(root, xAxis, pp ? 'Theoretical cumulative probability' : xKey, false, palette);
  addAxisLabel(root, yAxis, pp ? 'Observed cumulative probability' : yKey, true, palette);

  const color = resolveColor(output.color, palette.primary, palette);
  const series = chart.series.push(am5xy.LineSeries.new(root, {
    name: String(output.column || output.source_label || output.title || yKey),
    xAxis,
    yAxis,
    valueXField: 'x',
    valueYField: 'y',
    tooltip: makeTooltip(root, palette, `${xKey}: {valueX}\n${yKey}: {valueY}`),
    minBulletDistance: 0,
    maskBullets: false,
  }));
  // Keep the series itself visible and only make its connecting stroke
  // transparent. Setting the stroke template to visible=false can also hide
  // bullets while amCharts resolves compact/off-screen chart layouts.
  series.strokes.template.setAll({
    stroke: am5.color(color),
    strokeOpacity: 0,
    strokeWidth: 1,
  });
  addCircleBullets(
    root,
    series,
    color,
    Math.max(3.5, Math.min(7, Number(output.point_size || (pp ? 4.5 : 5)))),
    palette.text,
  );
  series.data.setAll(data);

  if (pp) {
    const reference = chart.series.push(am5xy.LineSeries.new(root, {
      name: 'x = y',
      xAxis,
      yAxis,
      valueXField: 'x',
      valueYField: 'y',
    }));
    reference.strokes.template.setAll({
      stroke: am5.color(palette.secondary),
      strokeWidth: 1.7,
      strokeOpacity: 0.9,
      strokeDasharray: [7, 5],
    });
    reference.data.setAll([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  }

  addCursor(root, chart, compact, palette);
  addLegend(root, chart, palette, compact);
  return chart;
}

function renderHistogram(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean) {
  const counts = ((output.counts as unknown[] | undefined) || []).map(Number);
  const edges = ((output.edges as unknown[] | undefined) || []).map(Number);
  if (!counts.length) return false;
  const data = counts.map((count, index) => {
    const start = Number.isFinite(edges[index]) ? edges[index] : index;
    const end = Number.isFinite(edges[index + 1]) ? edges[index + 1] : index + 1;
    return { start, end, count, range: `${formatNumber(start)} – ${formatNumber(end)}` };
  });

  const chart = createChart(root, compact);
  const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 52 });
  const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 38 });
  styleAxisRenderer(xRenderer, palette);
  styleAxisRenderer(yRenderer, palette);
  const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, { renderer: xRenderer, extraMin: 0.01, extraMax: 0.01 }));
  const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, { renderer: yRenderer, min: 0, extraMax: 0.1 }));
  addAxisLabel(root, xAxis, String(output.column || 'Value'), false, palette);
  addAxisLabel(root, yAxis, 'Count', true, palette);

  const color = resolveColor(output.color, palette.primary, palette);
  const series = chart.series.push(am5xy.ColumnSeries.new(root, {
    name: String(output.column || 'Histogram'),
    xAxis,
    yAxis,
    valueXField: 'end',
    openValueXField: 'start',
    valueYField: 'count',
    clustered: false,
    tooltip: makeTooltip(root, palette, '{range}\nCount: {valueY}'),
  }));
  series.columns.template.setAll({
    fill: am5.color(color),
    fillOpacity: 0.82,
    stroke: am5.color(color),
    strokeOpacity: 0.9,
    width: am5.percent(98),
    cornerRadiusTL: 3,
    cornerRadiusTR: 3,
  });
  series.columns.template.states.create('hover', { fillOpacity: 1, strokeWidth: 2 });
  series.data.setAll(data);
  addCursor(root, chart, compact, palette);
  return chart;
}

function renderHorizontalBar(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean) {
  const rows = ((output.rows as Record<string, unknown>[] | undefined) || []).slice(0, 80);
  const xKey = String(output.xKey || 'feature');
  const yKey = String(output.yKey || 'importance');
  const data = rows.map((row) => ({ category: String(row[xKey]), value: Number(row[yKey]) })).filter((row) => Number.isFinite(row.value));
  if (!data.length) return false;

  const chart = createChart(root, compact);
  const yRenderer = am5xy.AxisRendererY.new(root, { inversed: true, minGridDistance: 22 });
  const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 48 });
  styleAxisRenderer(yRenderer, palette);
  styleAxisRenderer(xRenderer, palette);
  yRenderer.grid.template.set('visible', false);
  const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, { renderer: yRenderer, categoryField: 'category' }));
  const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, { renderer: xRenderer, extraMax: 0.08 }));
  addAxisLabel(root, yAxis, xKey, true, palette);
  addAxisLabel(root, xAxis, yKey, false, palette);
  yAxis.data.setAll(data);

  const color = resolveColor(output.color, palette.primary, palette);
  const series = chart.series.push(am5xy.ColumnSeries.new(root, {
    name: yKey,
    xAxis,
    yAxis,
    categoryYField: 'category',
    valueXField: 'value',
    tooltip: makeTooltip(root, palette, '{categoryY}: {valueX}'),
  }));
  series.columns.template.setAll({
    fill: am5.color(color),
    fillOpacity: 0.86,
    strokeOpacity: 0,
    cornerRadiusTR: 6,
    cornerRadiusBR: 6,
    height: am5.percent(72),
  });
  series.columns.template.states.create('hover', { fillOpacity: 1 });
  series.data.setAll(data);
  addCursor(root, chart, compact, palette);
  return chart;
}

function renderLearningCurve(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean) {
  const xs = ((output.train_sizes as unknown[] | undefined) || []).map(Number);
  const train = ((output.train_score_mean as unknown[] | undefined) || []).map(Number);
  const test = ((output.test_score_mean as unknown[] | undefined) || []).map(Number);
  const data = xs.map((x, index) => ({ x, train: train[index], test: test[index] })).filter((row) => Number.isFinite(row.x));
  if (!data.length) return false;

  const chart = createChart(root, compact);
  const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 50 });
  const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 38 });
  styleAxisRenderer(xRenderer, palette);
  styleAxisRenderer(yRenderer, palette);
  const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, { renderer: xRenderer, extraMin: 0.03, extraMax: 0.03 }));
  const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
    renderer: yRenderer,
    min: finite(output.y_min),
    max: finite(output.y_max),
    strictMinMax: finite(output.y_min) !== undefined || finite(output.y_max) !== undefined,
    extraMin: 0.04,
    extraMax: 0.04,
  }));
  addAxisLabel(root, xAxis, 'Train size', false, palette);
  addAxisLabel(root, yAxis, 'Score', true, palette);

  const definitions = [
    { field: 'train', label: 'Train', color: resolveColor(output.color, palette.primary, palette) },
    { field: 'test', label: 'Test', color: resolveColor(output.color_secondary, palette.secondary, palette) },
  ];
  definitions.forEach((definition) => {
    const series = chart.series.push(am5xy.SmoothedXLineSeries.new(root, {
      name: definition.label,
      xAxis,
      yAxis,
      valueXField: 'x',
      valueYField: definition.field,
      tooltip: makeTooltip(root, palette, `${definition.label}: {valueY}\nTrain size: {valueX}`),
      tension: 0.65,
    }));
    series.strokes.template.setAll({ stroke: am5.color(definition.color), strokeWidth: 2.5, strokeOpacity: 0.95 });
    series.fills.template.setAll({ fill: am5.color(definition.color), fillOpacity: 0.05, visible: true });
    if (!compact) addCircleBullets(root, series, definition.color, 3.2, palette.panel);
    series.data.setAll(data);
  });
  addCursor(root, chart, compact, palette);
  addLegend(root, chart, palette, compact);
  return chart;
}

function renderBarPlot(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean) {
  const categories = ((output.categories as unknown[] | undefined) || []).map(String);
  const rawSeries = ((output.series as Array<Record<string, unknown>> | undefined) || []);
  const horizontal = String(output.orientation || 'vertical') === 'horizontal';
  if (!categories.length || !rawSeries.length) return false;
  const data = categories.map((category, categoryIndex) => {
    const row: Record<string, unknown> = { category };
    rawSeries.forEach((series, seriesIndex) => {
      const values = (series.data as unknown[] | undefined) || [];
      const value = values[categoryIndex];
      row[`series_${seriesIndex}`] = value == null ? null : Number(value);
    });
    return row;
  });

  const chart = createChart(root, compact);
  const categoryRenderer = horizontal
    ? am5xy.AxisRendererY.new(root, { inversed: true, minGridDistance: 24 })
    : am5xy.AxisRendererX.new(root, { minGridDistance: 34 });
  const valueRenderer = horizontal
    ? am5xy.AxisRendererX.new(root, { minGridDistance: 48 })
    : am5xy.AxisRendererY.new(root, { minGridDistance: 38 });
  styleAxisRenderer(categoryRenderer, palette, !horizontal && categories.length > 12 ? -35 : 0);
  styleAxisRenderer(valueRenderer, palette);
  categoryRenderer.grid.template.set('visible', false);

  const categoryAxis: any = horizontal
    ? chart.yAxes.push(am5xy.CategoryAxis.new(root, { renderer: categoryRenderer as any, categoryField: 'category' }))
    : chart.xAxes.push(am5xy.CategoryAxis.new(root, { renderer: categoryRenderer as any, categoryField: 'category' }));
  const valueAxis: any = horizontal
    ? chart.xAxes.push(am5xy.ValueAxis.new(root, { renderer: valueRenderer as any, extraMin: 0.04, extraMax: 0.08 }))
    : chart.yAxes.push(am5xy.ValueAxis.new(root, { renderer: valueRenderer as any, extraMin: 0.04, extraMax: 0.08 }));
  categoryAxis.data.setAll(data);
  addAxisLabel(root, categoryAxis, 'Selected columns', horizontal, palette);
  addAxisLabel(root, valueAxis, 'Value', !horizontal, palette);

  rawSeries.forEach((definition, index) => {
    const field = `series_${index}`;
    const label = String(definition.label || `Row ${index + 1}`);
    const color = resolveColor(definition.color, [palette.primary, palette.secondary, palette.success, palette.warning, palette.danger][index % 5], palette);
    const settings: any = horizontal ? {
      name: label,
      xAxis: valueAxis,
      yAxis: categoryAxis,
      categoryYField: 'category',
      valueXField: field,
      tooltip: makeTooltip(root, palette, `${label}\n{categoryY}: {valueX}`),
    } : {
      name: label,
      xAxis: categoryAxis,
      yAxis: valueAxis,
      categoryXField: 'category',
      valueYField: field,
      tooltip: makeTooltip(root, palette, `${label}\n{categoryX}: {valueY}`),
    };
    const series = chart.series.push(am5xy.ColumnSeries.new(root, settings));
    series.columns.template.setAll({
      fill: am5.color(color),
      fillOpacity: 0.86,
      strokeOpacity: 0,
      cornerRadiusTL: horizontal ? 0 : 5,
      cornerRadiusTR: 5,
      cornerRadiusBL: horizontal ? 0 : 2,
      cornerRadiusBR: 5,
      width: horizontal ? undefined : am5.percent(78),
      height: horizontal ? am5.percent(76) : undefined,
    });
    series.columns.template.states.create('hover', { fillOpacity: 1 });
    series.data.setAll(data);
  });

  const guidelines = ((output.guidelines as Array<Record<string, unknown>> | undefined) || [])
    .map((guide, index) => ({ value: Number(guide.value), label: String(guide.label || `Guide ${index + 1}`) }))
    .filter((guide) => Number.isFinite(guide.value));
  guidelines.forEach((guide, index) => addValueRange(root, valueAxis, guide.value, guide.label, [palette.warning, palette.danger, palette.secondary][index % 3], palette));
  addCursor(root, chart, compact, palette);
  addLegend(root, chart, palette, compact);
  return chart;
}

function matrixData(output: Output) {
  let labels = ((output.labels as unknown[] | undefined) || []).map(String);
  const rawMatrix = output.matrix as unknown;
  const rawRows = output.rows as unknown;
  let matrix: number[][] = [];
  if (Array.isArray(rawMatrix) && rawMatrix.every((row) => Array.isArray(row))) {
    matrix = rawMatrix.map((row) => (row as unknown[]).map(Number));
  } else {
    const objectRows = Array.isArray(rawMatrix) && rawMatrix.every((row) => row && typeof row === 'object' && !Array.isArray(row))
      ? rawMatrix as Record<string, unknown>[]
      : Array.isArray(rawRows) && rawRows.every((row) => row && typeof row === 'object' && !Array.isArray(row))
        ? rawRows as Record<string, unknown>[]
        : [];
    if (!labels.length && objectRows.length) labels = Object.keys(objectRows[0]).filter((key) => key !== 'column' && key !== 'index');
    matrix = objectRows.map((row) => labels.map((label) => Number(row[label])));
  }
  if (!labels.length && matrix.length) labels = matrix.map((_, index) => String(index));
  return { labels, matrix };
}

function renderHeatmap(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean) {
  const { labels, matrix } = matrixData(output);
  if (!labels.length || !matrix.length) return false;
  const finiteValues = matrix.flat().filter(Number.isFinite);
  if (!finiteValues.length) return false;
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const maxAbs = Math.max(Math.abs(min), Math.abs(max), 1e-9);
  const negative = am5.color(palette.danger);
  const neutral = am5.color(palette.control);
  const positive = am5.color(palette.primary);
  const cells = matrix.flatMap((row, rowIndex) => row.map((value, columnIndex) => {
    const ratio = Math.max(-1, Math.min(1, value / maxAbs));
    const fill = ratio < 0
      ? am5.Color.interpolate(Math.abs(ratio), neutral, negative)
      : am5.Color.interpolate(ratio, neutral, positive);
    return {
      column: labels[columnIndex] || String(columnIndex),
      row: labels[rowIndex] || String(rowIndex),
      value,
      displayValue: Number.isFinite(value) ? value.toFixed(2) : '-',
      columnSettings: { fill, stroke: am5.color(palette.panel) },
    };
  }));

  const chart = createChart(root, compact);
  const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 28 });
  const yRenderer = am5xy.AxisRendererY.new(root, { inversed: true, minGridDistance: 24 });
  styleAxisRenderer(xRenderer, palette, labels.length > 10 ? -45 : 0);
  styleAxisRenderer(yRenderer, palette);
  xRenderer.grid.template.set('visible', false);
  yRenderer.grid.template.set('visible', false);
  const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, { renderer: xRenderer, categoryField: 'column' }));
  const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, { renderer: yRenderer, categoryField: 'row' }));
  xAxis.data.setAll(labels.map((column) => ({ column })));
  yAxis.data.setAll(labels.map((row) => ({ row })));
  const series = chart.series.push(am5xy.ColumnSeries.new(root, {
    xAxis,
    yAxis,
    categoryXField: 'column',
    categoryYField: 'row',
    valueField: 'value',
    calculateAggregates: true,
    tooltip: makeTooltip(root, palette, '{row} × {column}: {value}'),
  }));
  series.columns.template.setAll({
    templateField: 'columnSettings',
    strokeWidth: 1,
    width: am5.percent(96),
    height: am5.percent(96),
    cornerRadiusTL: 4,
    cornerRadiusTR: 4,
    cornerRadiusBL: 4,
    cornerRadiusBR: 4,
  });
  series.columns.template.states.create('hover', { stroke: am5.color(palette.text), strokeWidth: 2 });
  if (cells.length <= 225 && !compact) {
    series.bullets.push(() => am5.Bullet.new(root, {
      sprite: am5.Label.new(root, {
        text: '{displayValue}',
        populateText: true,
        fill: am5.color(palette.text),
        fontSize: labels.length > 8 ? 8 : 10,
        centerX: am5.p50,
        centerY: am5.p50,
      }),
    }));
  }
  series.data.setAll(cells);
  return chart;
}

function renderBoxPlot(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean) {
  const quantiles = (output.quantiles || {}) as Record<string, unknown>;
  const min = finite(quantiles['0'] ?? quantiles.min ?? output.min);
  const q1 = finite(quantiles['0.25'] ?? quantiles.q1 ?? output.q1);
  const median = finite(quantiles['0.5'] ?? quantiles.median ?? output.median);
  const q3 = finite(quantiles['0.75'] ?? quantiles.q3 ?? output.q3);
  const max = finite(quantiles['1'] ?? quantiles.max ?? output.max);
  if ([min, q1, median, q3, max].some((value) => value === undefined)) return false;
  const category = String(output.column || 'Distribution');
  const data = [{ category, low: min, open: q1, median, close: q3, high: max }];

  const chart = createChart(root, compact);
  const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 40 });
  const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 38 });
  styleAxisRenderer(xRenderer, palette);
  styleAxisRenderer(yRenderer, palette);
  xRenderer.grid.template.set('visible', false);
  const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, { renderer: xRenderer, categoryField: 'category' }));
  const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, { renderer: yRenderer, extraMin: 0.12, extraMax: 0.12 }));
  xAxis.data.setAll(data);
  addAxisLabel(root, yAxis, category, true, palette);

  const color = resolveColor(output.color, palette.primary, palette);
  const series = chart.series.push(am5xy.CandlestickSeries.new(root, {
    xAxis,
    yAxis,
    categoryXField: 'category',
    lowValueYField: 'low',
    openValueYField: 'open',
    valueYField: 'close',
    highValueYField: 'high',
    tooltip: makeTooltip(root, palette, 'Min: {lowValueY}\nQ1: {openValueY}\nMedian: {median}\nQ3: {valueY}\nMax: {highValueY}'),
  }));
  series.columns.template.setAll({
    fill: am5.color(color),
    fillOpacity: 0.42,
    stroke: am5.color(color),
    strokeWidth: 2,
    width: am5.percent(34),
  });
  series.data.setAll(data);
  addValueRange(root, yAxis, median as number, 'Median', palette.secondary, palette);
  addCursor(root, chart, compact, palette);
  return chart;
}

function renderStairOutlier(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean) {
  const ranks = ((output.ranks as unknown[] | undefined) || []).map(Number);
  const original = ((output.original_values as unknown[] | undefined) || []).map((value) => value == null ? null : Number(value));
  const corrected = ((output.corrected_values as unknown[] | undefined) || []).map((value) => value == null ? null : Number(value));
  const flags = ((output.outlier_flags as unknown[] | undefined) || []).map(Boolean);
  const data = ranks.map((rank, index) => ({ rank, original: original[index], corrected: corrected[index], outlier: flags[index] ? original[index] : null })).filter((row) => Number.isFinite(row.rank));
  if (!data.length) return false;
  const showCorrected = String(output.replacement || 'keep') !== 'keep' && corrected.some((value, index) => value !== original[index]);

  const chart = createChart(root, compact);
  const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 50 });
  const yRenderer = am5xy.AxisRendererY.new(root, { minGridDistance: 38 });
  styleAxisRenderer(xRenderer, palette);
  styleAxisRenderer(yRenderer, palette);
  const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, { renderer: xRenderer, extraMin: 0.01, extraMax: 0.01 }));
  const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, { renderer: yRenderer, extraMin: 0.05, extraMax: 0.05 }));
  addAxisLabel(root, xAxis, 'Sorted rank', false, palette);
  addAxisLabel(root, yAxis, String(output.column || 'Value'), true, palette);

  const definitions = [
    { field: 'original', label: 'Original sorted values', color: resolveColor(output.color, palette.primary, palette) },
    ...(showCorrected ? [{ field: 'corrected', label: 'Corrected values', color: palette.success }] : []),
  ];
  definitions.forEach((definition) => {
    const series = chart.series.push(am5xy.StepLineSeries.new(root, {
      name: definition.label,
      xAxis,
      yAxis,
      valueXField: 'rank',
      valueYField: definition.field,
      tooltip: makeTooltip(root, palette, `Rank: {valueX}\n${definition.label}: {valueY}`),
      noRisers: false,
    }));
    series.strokes.template.setAll({ stroke: am5.color(definition.color), strokeWidth: 2.3, strokeOpacity: 0.95 });
    series.data.setAll(data);
  });

  const outlierSeries = chart.series.push(am5xy.LineSeries.new(root, {
    name: 'Detected outlier',
    xAxis,
    yAxis,
    valueXField: 'rank',
    valueYField: 'outlier',
    tooltip: makeTooltip(root, palette, 'Outlier\nRank: {valueX}\nValue: {valueY}'),
  }));
  outlierSeries.strokes.template.setAll({ visible: false, strokeOpacity: 0 });
  addCircleBullets(root, outlierSeries, palette.danger, 4.2, palette.panel);
  outlierSeries.data.setAll(data.filter((row) => row.outlier !== null));

  const lower = finite(output.lower_boundary);
  const upper = finite(output.upper_boundary);
  if (lower !== undefined) addValueRange(root, yAxis, lower, 'Lower boundary', palette.warning, palette);
  if (upper !== undefined) addValueRange(root, yAxis, upper, 'Upper boundary', palette.danger, palette);
  addCursor(root, chart, compact, palette);
  addLegend(root, chart, palette, compact);
  return chart;
}

function chartHeight(output: Output) {
  const kind = String(output.kind || 'plot');
  if (kind === 'bar') {
    const rows = (output.rows as unknown[] | undefined) || [];
    return Math.max(280, Math.min(900, rows.length * 25 + 100));
  }
  if (kind === 'bar_plot' && String(output.orientation || 'vertical') === 'horizontal') {
    const categories = (output.categories as unknown[] | undefined) || [];
    return Math.max(300, Math.min(900, categories.length * 32 + 110));
  }
  if (kind === 'heatmap' || kind === 'matrix') {
    const labels = (output.labels as unknown[] | undefined) || [];
    return Math.max(300, Math.min(820, labels.length * 34 + 100));
  }
  if (kind === 'stair_outlier') return 330;
  if (kind === 'boxplot') return 285;
  return 300;
}

const AmChartsOutput = memo(function AmChartsOutput({ output, collectionMode = false }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const themeKey = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeSnapshot);
  const kind = String(output.kind || 'plot');
  const height = chartHeight(output);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const palette = themePalette();
    const root = createRoot(element, palette, !collectionMode);
    let chart: am5xy.XYChart | false = false;
    try {
      if (kind === 'scatter') chart = renderScatter(root, output, palette, collectionMode, false);
      else if (kind === 'pp_plot') chart = renderScatter(root, output, palette, collectionMode, true);
      else if (kind === 'histogram') chart = renderHistogram(root, output, palette, collectionMode);
      else if (kind === 'bar') chart = renderHorizontalBar(root, output, palette, collectionMode);
      else if (kind === 'line') chart = renderLearningCurve(root, output, palette, collectionMode);
      else if (kind === 'bar_plot') chart = renderBarPlot(root, output, palette, collectionMode);
      else if (kind === 'heatmap' || kind === 'matrix') chart = renderHeatmap(root, output, palette, collectionMode);
      else if (kind === 'boxplot') chart = renderBoxPlot(root, output, palette, collectionMode);
      else if (kind === 'stair_outlier') chart = renderStairOutlier(root, output, palette, collectionMode);
      if (chart && !collectionMode) chart.appear(420, 40);
    } catch (error) {
      console.error(`amCharts render failed for ${kind}`, error);
      element.dataset.chartError = 'true';
    }
    return () => root.dispose();
  }, [collectionMode, kind, output, themeKey]);

  return (
    <div className="amchart-wrap" style={{ height }} data-chart-kind={kind} data-theme-key={themeKey}>
      <div ref={ref} className="amchart-canvas" role="img" aria-label={String(output.title || kind)} />
    </div>
  );
});

export default AmChartsOutput;
