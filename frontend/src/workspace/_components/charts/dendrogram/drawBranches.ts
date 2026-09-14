import { colorIndex } from './geometry';
import type { DendrogramGeometry, DendrogramSegment } from './types';
export function drawBranches(context: CanvasRenderingContext2D, geometry: DendrogramGeometry, segments: DendrogramSegment[], colors: string[]) {
    segments.forEach((segment, segmentIndex) => {
        const points = (segment.points || []).filter((point) => Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)));
        if (points.length < 2)
            return;
        const index = colorIndex(String(segment.color_key || ''), segmentIndex);
        context.beginPath();
        context.moveTo(geometry.mapX(points[0].x), geometry.mapY(points[0].y));
        for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
            context.lineTo(geometry.mapX(points[pointIndex].x), geometry.mapY(points[pointIndex].y));
        }
        context.strokeStyle = colors[index % colors.length];
        context.lineWidth = geometry.compact ? 1.25 : 1.6;
        context.globalAlpha = 0.95;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.stroke();
    });
}
