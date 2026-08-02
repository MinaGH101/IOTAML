import * as am5 from '@amcharts/amcharts5';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import * as am5xy from '@amcharts/amcharts5/xy';

const amChartsLicenseKey = String(import.meta.env.VITE_AMCHARTS_LICENSE_KEY || '').trim();
if (amChartsLicenseKey) am5.addLicense(amChartsLicenseKey);

export type ChartPalette = {
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
export function themePalette(): ChartPalette {
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

export function resolveColor(raw: unknown, fallback: string, palette: ChartPalette) {
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

export function finite(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function formatNumber(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  if (Math.abs(number) >= 1000) return number.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return number.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function createRoot(element: HTMLDivElement, palette: ChartPalette, animated: boolean) {
  const root = am5.Root.new(element, {
    // Board zoom uses a CSS transform. Layout dimensions avoid measuring the
    // transformed visual size twice when amCharts recalculates its canvas.
    calculateSize: () => ({
      width: Math.max(element.clientWidth, element.parentElement?.clientWidth || 0, 1),
      height: Math.max(element.clientHeight, element.parentElement?.clientHeight || 0, 1),
    }),
  });
  if (animated) root.setThemes([am5themes_Animated.new(root)]);
  root.numberFormatter.set('numberFormat', '#,###.####');
  return root;
}

export function createChart(root: am5.Root, compact: boolean) {
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

export function styleAxisRenderer(renderer: any, palette: ChartPalette, labelRotation = 0) {
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

export function addAxisLabel(root: am5.Root, axis: any, text: string, vertical: boolean, palette: ChartPalette) {
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

export function makeTooltip(root: am5.Root, palette: ChartPalette, labelText: string) {
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

export function addCursor(root: am5.Root, chart: am5xy.XYChart, compact: boolean, palette: ChartPalette) {
  if (compact) return;
  const cursor = chart.set('cursor', am5xy.XYCursor.new(root, { behavior: 'zoomX' }));
  cursor.lineX.setAll({ stroke: am5.color(palette.muted), strokeOpacity: 0.38 });
  cursor.lineY.setAll({ stroke: am5.color(palette.muted), strokeOpacity: 0.24 });
}

export function addLegend(root: am5.Root, chart: am5xy.XYChart, palette: ChartPalette, compact: boolean) {
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

export function addValueRange(root: am5.Root, axis: any, value: number, label: string, color: string, palette: ChartPalette) {
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

export function addCircleBullets(root: am5.Root, series: any, color: string, radius: number, strokeColor: string) {
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

