import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import type { Output } from '../../../../../workspace/_model/output';
import { addAxisLabel, addCircleBullets, addCursor, addLegend, createChart, finite, makeTooltip, resolveColor, styleAxisRenderer, type ChartPalette } from '../chartCore';

export function renderHorizontalBar(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean) {
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

export function renderLearningCurve(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean) {
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

