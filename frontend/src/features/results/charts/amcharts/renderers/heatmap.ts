import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import type { Output } from '../../../../../workspace/_model/output';
import { createChart, makeTooltip, styleAxisRenderer, type ChartPalette } from '../chartCore';

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

export function renderHeatmap(root: am5.Root, output: Output, palette: ChartPalette, compact: boolean) {
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
  

    if (!compact) {
    const legendContainer = chart.bottomAxesContainer.children.push(
      am5.Container.new(root, {
        width: am5.percent(100),
        layout: root.horizontalLayout,
        paddingTop: 10,
        paddingLeft: 30,
        paddingRight: 20,
      }),
    );

    const negativeLegend = legendContainer.children.push(
      am5.HeatLegend.new(root, {
        orientation: 'horizontal',
        startColor: negative,
        endColor: neutral,
        startValue: -maxAbs,
        endValue: 0,
        stepCount: 50,
        width: am5.percent(50),
      }),
    );

    const positiveLegend = legendContainer.children.push(
      am5.HeatLegend.new(root, {
        orientation: 'horizontal',
        startColor: neutral,
        endColor: positive,
        startValue: 0,
        endValue: maxAbs,
        stepCount: 50,
        width: am5.percent(50),
      }),
    );

    [negativeLegend, positiveLegend].forEach((legend) => {
      legend.startLabel.setAll({
        fill: am5.color(palette.muted),
        fontSize: 10,
        fontFamily: palette.font,
      });

      legend.endLabel.setAll({
        fill: am5.color(palette.muted),
        fontSize: 10,
        fontFamily: palette.font,
      });
    });
  }
  return chart;
}

