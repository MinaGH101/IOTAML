import { useCallback } from 'react';
import type { BoardViewport } from '../../../_model/board';
import { useViewportInteractions } from './board-viewport/useViewportInteractions';
import { useViewportRenderer } from './board-viewport/useViewportRenderer';
export function useBoardViewport({ activeBoardId, initialViewport, storageScope }: {
    activeBoardId: string;
    initialViewport: BoardViewport;
    storageScope: string;
}) { const renderer = useViewportRenderer(activeBoardId, initialViewport, storageScope); const startPan = useViewportInteractions(renderer); const getViewportScale = useCallback(() => renderer.viewportRef.current.scale, [renderer.viewportRef]); return { canvasRef: renderer.canvasRef, worldRef: renderer.worldRef, startPan, getViewportScale }; }
