import { useLayoutEffect, type RefObject } from 'react';
import type { Output } from '../../../_model/output';
import { drawDendrogram } from './drawDendrogram';
export function useDendrogramCanvas(containerRef: RefObject<HTMLDivElement | null>, canvasRef: RefObject<HTMLCanvasElement | null>, output: Output, compact: boolean, themeKey: string) {
    useLayoutEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas)
            return undefined;
        let frame = 0;
        const scheduleDraw = () => {
            if (frame)
                return;
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                drawDendrogram(canvas, output, compact);
            });
        };
        const resizeObserver = new ResizeObserver(scheduleDraw);
        resizeObserver.observe(container);
        scheduleDraw();
        return () => {
            resizeObserver.disconnect();
            if (frame)
                window.cancelAnimationFrame(frame);
            canvas.width = 1;
            canvas.height = 1;
        };
    }, [canvasRef, compact, containerRef, output, themeKey]);
}
