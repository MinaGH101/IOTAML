import { createGeometry } from './geometry';
import { drawBranches } from './drawBranches';
import { drawGrid } from './drawGrid';
import { drawLabels } from './drawLabels';
import { branchColors, cssColor } from './theme';
import type { DendrogramOutputData } from './types';
export function drawDendrogram(canvas: HTMLCanvasElement, output: DendrogramOutputData, compact: boolean) {
    const segments = output.segments || [];
    const labels = output.labels || [];
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const pixelRatio = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    const nextWidth = Math.round(width * pixelRatio);
    const nextHeight = Math.round(height * pixelRatio);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
    }
    const context = canvas.getContext('2d', { alpha: true });
    if (!context)
        return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    const styles = getComputedStyle(document.documentElement);
    const fontFamily = cssColor(styles, '--theme-font-family', 'sans-serif');
    context.font = `${compact ? 9 : 11}px ${fontFamily}`;
    const geometry = createGeometry(context, width, height, compact, labels, segments, output.maximum_distance);
    drawGrid(context, geometry, cssColor(styles, '--theme-divider', 'ButtonBorder'), cssColor(styles, '--theme-text-muted', 'GrayText'));
    drawBranches(context, geometry, segments, branchColors(styles));
    drawLabels(context, geometry, labels, cssColor(styles, '--theme-text', 'CanvasText'), fontFamily);
}
