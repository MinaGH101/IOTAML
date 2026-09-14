import { useCallback, useLayoutEffect, type PointerEvent as ReactPointerEvent } from 'react';
import { setBoardInteractionActive } from '../../_utils/boardInteraction';
import { zoomAt } from './model';
import type { useViewportRenderer } from './useViewportRenderer';
export function useViewportInteractions(r: ReturnType<typeof useViewportRenderer>) { useLayoutEffect(() => { const canvas = r.canvasRef.current; if (!canvas)
    return; const handleWheel = (event: WheelEvent) => { const target = event.target as HTMLElement | null; if (target?.closest('.analysis-board-card-body, .analysis-output-picker, .analysis-board-toolbar-direct'))
    return; event.preventDefault(); const rect = canvas.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top; const current = r.viewportRef.current; if (event.ctrlKey || event.metaKey) {
    r.apply(zoomAt(current, current.scale * Math.exp(-event.deltaY * .0015), x, y));
    return;
} const panX = event.shiftKey ? event.deltaY : event.deltaX; const panY = event.shiftKey ? 0 : event.deltaY; r.apply({ ...current, x: current.x - panX, y: current.y - panY }); }; canvas.addEventListener('wheel', handleWheel, { passive: false }); return () => canvas.removeEventListener('wheel', handleWheel); }, [r.apply, r.canvasRef, r.viewportRef]); const startPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => { const target = event.target as HTMLElement; if (event.button !== 0 || target.closest('.analysis-board-card, .analysis-output-picker, .analysis-board-empty, .analysis-board-toolbar-direct, button, input, textarea, select'))
    return; event.preventDefault(); const canvas = event.currentTarget; const pointerId = event.pointerId; const startX = event.clientX; const startY = event.clientY; const start = { ...r.viewportRef.current }; setBoardInteractionActive(true); try {
    canvas.setPointerCapture(pointerId);
}
catch { } const move = (e: PointerEvent) => { if (e.pointerId === pointerId)
    r.apply({ ...start, x: start.x + e.clientX - startX, y: start.y + e.clientY - startY }); }; const finish = (e: PointerEvent) => { if (e.pointerId !== pointerId)
    return; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', finish); r.cancel(); r.commit(r.activeBoardIdRef.current, r.viewportRef.current); setBoardInteractionActive(false); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish); }, [r.activeBoardIdRef, r.apply, r.cancel, r.commit, r.viewportRef]); return startPan; }
