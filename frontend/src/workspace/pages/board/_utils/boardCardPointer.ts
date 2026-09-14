import type { PointerEvent as ReactPointerEvent } from 'react';
import type { AnalysisBoardItem } from '../../../_model/board';
import { clamp, setBoardInteractionActive } from './boardInteraction';
export function startBoardPointerAction(event: ReactPointerEvent<HTMLElement>, item: AnalysisBoardItem, action: 'move' | 'resize', getViewportScale: () => number, onUpdateItem: (id: string, patch: Partial<AnalysisBoardItem>) => void) { if (event.button !== 0)
    return; event.preventDefault(); event.stopPropagation(); const handle = event.currentTarget; const card = handle.closest<HTMLElement>('.analysis-board-card'); if (!card)
    return; const pointerId = event.pointerId; const startX = event.clientX; const startY = event.clientY; const start = { ...item }; const latest = { x: start.x, y: start.y, w: start.w, h: start.h }; let frame = 0; setBoardInteractionActive(true); try {
    handle.setPointerCapture(pointerId);
}
catch { } const render = () => { frame = 0; if (action === 'move')
    card.style.transform = `translate3d(${latest.x - start.x}px, ${latest.y - start.y}px, 0)`;
else {
    card.style.width = `${latest.w}px`;
    card.style.height = `${latest.h}px`;
} }; const move = (e: PointerEvent) => { if (e.pointerId !== pointerId)
    return; const scale = Math.max(.01, getViewportScale()); const dx = (e.clientX - startX) / scale; const dy = (e.clientY - startY) / scale; if (action === 'move') {
    latest.x = clamp(start.x + dx, -4000, 8000);
    latest.y = clamp(start.y + dy, -4000, 8000);
}
else {
    latest.w = Math.max(180, start.w + dx);
    latest.h = Math.max(140, start.h + dy);
} if (!frame)
    frame = window.requestAnimationFrame(render); }; const finish = (e: PointerEvent) => { if (e.pointerId !== pointerId)
    return; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', finish); if (frame)
    window.cancelAnimationFrame(frame); if (action === 'move') {
    card.style.left = `${latest.x}px`;
    card.style.top = `${latest.y}px`;
    card.style.transform = '';
    onUpdateItem(item.id, { x: latest.x, y: latest.y });
}
else
    onUpdateItem(item.id, { w: latest.w, h: latest.h }); setBoardInteractionActive(false); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish); }
