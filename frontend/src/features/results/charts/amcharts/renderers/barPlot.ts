import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import type { Output } from '../../../../../workspace/_model/output';
import { addAxisLabel, addCursor, addLegend, addValueRange, createChart, makeTooltip, resolveColor, styleAxisRenderer, type ChartPalette } from '../chartCore';

export function renderBarPlot(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean) {
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
    ? chart.yAxes.push(am5xy.CategoryAxis.new(root, { renderer: categoryRenderer as unknown as am5xy.AxisRendererY, categoryField: 'category' }))
    : chart.xAxes.push(am5xy.CategoryAxis.new(root, { renderer: categoryRenderer as unknown as am5xy.AxisRendererX, categoryField: 'category' }));
  const valueAxis: any = horizontal
    ? chart.xAxes.push(am5xy.ValueAxis.new(root, { renderer: valueRenderer as unknown as am5xy.AxisRendererX, extraMin: 0.04, extraMax: 0.08 }))
    : chart.yAxes.push(am5xy.ValueAxis.new(root, { renderer: valueRenderer as unknown as am5xy.AxisRendererY, extraMin: 0.04, extraMax: 0.08 }));
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

