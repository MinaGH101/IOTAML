import type { DendrogramGeometry, DendrogramLabel, DendrogramSegment } from './types';
export function finite(value: unknown, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}
export function colorIndex(colorKey: string, fallback: number) {
    const parsed = Number(colorKey.replace(/[^0-9]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
}
export function createGeometry(context: CanvasRenderingContext2D, width: number, height: number, compact: boolean, labels: DendrogramLabel[], segments: DendrogramSegment[], maximumDistanceValue: unknown): DendrogramGeometry {
    const maximumLabelWidth = labels.reduce((maximum, item) => Math.max(maximum, context.measureText(String(item.label || '')).width), 0);
    const labelWidth = Math.min(compact ? 96 : 180, Math.max(compact ? 48 : 62, maximumLabelWidth + 12));
    const plotLeft = labelWidth + (compact ? 8 : 12);
    const plotRight = Math.max(plotLeft + 40, width - (compact ? 10 : 18));
    const plotTop = compact ? 10 : 16;
    const plotBottom = Math.max(plotTop + 40, height - (compact ? 24 : 34));
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;
    const maximumDistance = Math.max(1e-12, finite(maximumDistanceValue), ...segments.flatMap((segment) => (segment.points || []).map((point) => finite(point.x))));
    const maximumPosition = Math.max(10, ...labels.map((item) => finite(item.position))) + 5;
    const mapX = (value: unknown) => plotLeft + (finite(value) / maximumDistance) * plotWidth;
    const mapY = (value: unknown) => plotTop + (finite(value) / maximumPosition) * plotHeight;
    return { compact, width, height, labelWidth, plotLeft, plotRight, plotTop, plotBottom, plotWidth, plotHeight, maximumDistance, maximumPosition, mapX, mapY };
}
