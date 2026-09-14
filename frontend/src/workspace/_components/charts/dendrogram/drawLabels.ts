import type { DendrogramGeometry, DendrogramLabel } from './types';
export function drawLabels(context: CanvasRenderingContext2D, geometry: DendrogramGeometry, labels: DendrogramLabel[], textColor: string, fontFamily: string) {
    const fontSize = geometry.compact ? 9 : 11;
    const minimumLabelGap = geometry.compact ? 11 : 14;
    context.globalAlpha = 1;
    context.fillStyle = textColor;
    context.font = `${fontSize}px ${fontFamily}`;
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    let previousLabelY = Number.NEGATIVE_INFINITY;
    labels.forEach((item) => {
        const y = geometry.mapY(item.position);
        if (y - previousLabelY < minimumLabelGap)
            return;
        previousLabelY = y;
        context.save();
        context.beginPath();
        context.rect(0, y - minimumLabelGap, geometry.labelWidth, minimumLabelGap * 2);
        context.clip();
        context.fillText(String(item.label || ''), geometry.plotLeft - 5, y);
        context.restore();
    });
}
