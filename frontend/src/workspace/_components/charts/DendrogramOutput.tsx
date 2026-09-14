import { memo, useRef, useSyncExternalStore } from 'react';
import type { Output } from '../../_model/output';
import { chartHeight } from './chartSizing';
import { getThemeSnapshot, subscribeTheme } from './chartTheme';
import { useDendrogramCanvas } from './dendrogram/useDendrogramCanvas';
type Props = {
    output: Output;
    collectionMode?: boolean;
};
const DendrogramOutput = memo(function DendrogramOutput({ output, collectionMode = false }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const themeKey = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeSnapshot);
    useDendrogramCanvas(containerRef, canvasRef, output, collectionMode, themeKey);
    return (<div ref={containerRef} className="amchart-wrap dendrogram-canvas-wrap" style={{ height: chartHeight(output) }} data-chart-kind="dendrogram" data-theme-key={themeKey}>
      <canvas ref={canvasRef} className="dendrogram-canvas" role="img" aria-label={String(output.title || 'Clustering dendrogram')}/>
    </div>);
});
export default DendrogramOutput;
