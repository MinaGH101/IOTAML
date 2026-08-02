import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import type { Output } from '../../../../../workspace/_model/output';
import { evenlySample } from '../../../../../workspace/_model/chartData';
import { addAxisLabel, addCircleBullets, addCursor, addLegend, addValueRange, createChart, finite, makeTooltip, resolveColor, styleAxisRenderer, type ChartPalette } from '../chartCore';

export function renderBoxPlot(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean) {
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

export function renderStairOutlier(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean) {
  const ranks = ((output.ranks as unknown[] | undefined) || []).map(Number);
  const original = ((output.original_values as unknown[] | undefined) || []).map((value) => value == null ? null : Number(value));
  const corrected = ((output.corrected_values as unknown[] | undefined) || []).map((value) => value == null ? null : Number(value));
  const flags = ((output.outlier_flags as unknown[] | undefined) || []).map(Boolean);
  const fullData = ranks
    .map((rank, index) => ({ rank, original: original[index], corrected: corrected[index], outlier: flags[index] ? original[index] : null }))
    .filter((row) => Number.isFinite(row.rank));
  const sampledData = evenlySample(fullData, compact ? 1200 : 4000);
  const data = Array.from(
    new Map(
      [...sampledData, ...fullData.filter((row) => row.outlier !== null)]
        .map((row) => [row.rank, row] as const),
    ).values(),
  ).sort((left, right) => left.rank - right.rank);
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
