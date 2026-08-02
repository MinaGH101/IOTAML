import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import type { Output } from '../../../../../workspace/_model/output';
import { addAxisLabel, addCursor, createChart, formatNumber, makeTooltip, resolveColor, styleAxisRenderer, type ChartPalette } from '../chartCore';

export function renderHistogram(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean) {
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

