import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import type { Output } from '../../../../../workspace/_model/output';
import { evenlySample } from '../../../../../workspace/_model/chartData';
import { addAxisLabel, addCircleBullets, addCursor, addLegend, addValueRange, createChart, finite, makeTooltip, resolveColor, styleAxisRenderer, type ChartPalette } from '../chartCore';

export function renderScatter(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean, pp = false) {
  const points = ((output.points as Record<string, unknown>[] | undefined) || (output.rows as Record<string, unknown>[] | undefined) || []);
  const xKey = String(output.x || (pp ? 'theoretical_probability' : 'x'));
  const yKey = String(output.y || (pp ? 'observed_probability' : 'y'));
  const data = evenlySample(
    points
      .map((point) => ({ x: Number(point[xKey]), y: Number(point[yKey]) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
    compact ? 800 : 2500,
  );
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

