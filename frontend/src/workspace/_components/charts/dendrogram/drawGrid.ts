import type { DendrogramGeometry } from './types';
export function drawGrid(context: CanvasRenderingContext2D, geometry: DendrogramGeometry, gridColor: string, mutedColor: string) {
    const { plotLeft, plotTop, plotBottom, plotWidth, maximumDistance } = geometry;
    context.save();
    context.strokeStyle = gridColor;
    context.fillStyle = mutedColor;
    context.lineWidth = 1;
    context.globalAlpha = 0.35;
    context.setLineDash([3, 4]);
    context.textAlign = 'center';
    context.textBaseline = 'top';
    for (let index = 0; index <= 5; index += 1) {
        const ratio = index / 5;
        const x = plotLeft + ratio * plotWidth;
        context.beginPath();
        context.moveTo(x, plotTop);
        context.lineTo(x, plotBottom);
        context.stroke();
        context.globalAlpha = 0.8;
        context.fillText((ratio * maximumDistance).toLocaleString('en-US', { maximumFractionDigits: 3 }), x, plotBottom + 6);
        context.globalAlpha = 0.35;
    }
    context.restore();
}
