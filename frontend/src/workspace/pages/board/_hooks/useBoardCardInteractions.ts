import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { AnalysisBoardItem } from '../../../_model/board';
import { BOARD_BASE_WIDTH, arrangeBoardRows, boardOuterWidthLimit, clampBoardHeight, clampBoardWidth, resizeBoardPair, type BoardItemPlacement } from '../_utils/boardGrid';

type ResizePreview = { id: string; w: number; h: number; neighborId?: string; neighborW?: number };
export type ResizeHandle = 'left' | 'right' | 'bottom' | 'bottom-left' | 'bottom-right';
export type BoardDropTarget = BoardItemPlacement;
type Options = {
    items: AnalysisBoardItem[];
    columns: number;
    unitWidth: number;
    layoutWidth: number;
    movable: boolean;
    resizable: boolean;
    boardZoom: number;
    canvasRef: RefObject<HTMLDivElement | null>;
    gridRef: RefObject<HTMLDivElement | null>;
    onMoveItem: (sourceId: string, target: BoardDropTarget) => void;
    onUpdateItem: (id: string, patch: Partial<AnalysisBoardItem>) => void;
};

export function useBoardCardInteractions({ items, columns, unitWidth, layoutWidth, movable, resizable, boardZoom, canvasRef, gridRef, onMoveItem, onUpdateItem }: Options) {
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dropTarget, setDropTargetState] = useState<BoardDropTarget | null>(null);
    const [resizePreview, setResizePreview] = useState<ResizePreview | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);
    const dropTargetRef = useRef<BoardDropTarget | null>(null);

    const setDropTarget = useCallback((next: BoardDropTarget | null) => {
        const current = dropTargetRef.current;
        if (current?.targetId === next?.targetId && current?.after === next?.after && current?.newRow === next?.newRow)
            return;
        dropTargetRef.current = next;
        setDropTargetState(next);
    }, []);

    useEffect(() => () => cleanupRef.current?.(), []);
    useEffect(() => {
        if (movable || resizable) return;
        cleanupRef.current?.();
        setDraggingId(null);
        setDropTarget(null);
        setResizePreview(null);
    }, [movable, resizable, setDropTarget]);

    const targetAt = useCallback((x: number, y: number): BoardDropTarget | null => {
        const grid = gridRef.current;
        if (!grid) return null;
        const bounds = grid.getBoundingClientRect();
        if (x < bounds.left || x > bounds.right || y < bounds.top - 20 || y > bounds.bottom + 30) return null;
        const rows = [...grid.querySelectorAll<HTMLElement>('.analysis-board-row')];
        if (!rows.length) return null;
        const row = rows.reduce((closest, candidate) => {
            const distance = (element: HTMLElement) => {
                const rect = element.getBoundingClientRect();
                return y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
            };
            return distance(candidate) < distance(closest) ? candidate : closest;
        });
        const cells = [...row.querySelectorAll<HTMLElement>('.analysis-board-grid-cell')];
        const rowRect = row.getBoundingClientRect();
        const firstId = cells[0]?.dataset.boardItemId;
        const lastId = cells[cells.length - 1]?.dataset.boardItemId;
        if (y < rowRect.top)
            return firstId ? { targetId: firstId, after: false, newRow: true } : null;
        if (y > rowRect.bottom)
            return lastId ? { targetId: lastId, after: true, newRow: true } : null;
        for (const cell of cells) {
            const id = cell.dataset.boardItemId;
            if (!id) continue;
            const rect = cell.getBoundingClientRect();
            if (x >= (rect.left + rect.right) / 2) return { targetId: id, after: false };
        }
        return lastId ? { targetId: lastId, after: true } : null;
    }, [gridRef]);

    const startMove = useCallback((event: ReactPointerEvent<HTMLElement>, id: string) => {
        if (!movable || event.button !== 0 || (event.target as HTMLElement).closest('button, input, .analysis-board-zoom')) return;
        event.preventDefault();
        cleanupRef.current?.();
        const startX = event.clientX;
        const startY = event.clientY;
        const pointerId = event.pointerId;
        let moved = false;
        let target: BoardDropTarget | null = null;
        let dragPreview: HTMLDivElement | null = null;
        let targetFrame = 0;
        let targetX = startX;
        let targetY = startY;
        const updateTarget = (x: number, y: number) => {
            const next = targetAt(x, y);
            target = next?.targetId === id ? null : next;
            setDropTarget(target);
        };
        const scheduleTarget = (x: number, y: number) => {
            targetX = x;
            targetY = y;
            if (targetFrame) return;
            targetFrame = window.requestAnimationFrame(() => {
                targetFrame = 0;
                updateTarget(targetX, targetY);
            });
        };
        const move = (pointer: PointerEvent) => {
            if (pointer.pointerId !== pointerId) return;
            if (!moved && Math.hypot(pointer.clientX - startX, pointer.clientY - startY) < 6) return;
            if (!moved) {
                moved = true;
                setDraggingId(id);
                dragPreview = document.createElement('div');
                dragPreview.className = 'analysis-board-drag-preview';
                dragPreview.textContent = items.find((item) => item.id === id)?.outputTitle || '';
                dragPreview.setAttribute('aria-hidden', 'true');
                document.body.appendChild(dragPreview);
            }
            if (dragPreview) dragPreview.style.transform = `translate3d(${pointer.clientX + 12}px, ${pointer.clientY + 12}px, 0)`;
            scheduleTarget(pointer.clientX, pointer.clientY);
            const canvas = canvasRef.current;
            if (canvas) {
                const bounds = canvas.getBoundingClientRect();
                if (pointer.clientY < bounds.top + 44) canvas.scrollTop -= 18;
                if (pointer.clientY > bounds.bottom - 44) canvas.scrollTop += 18;
            }
        };
        const finish = (pointer: PointerEvent) => {
            if (pointer.pointerId !== pointerId) return;
            if (targetFrame) {
                window.cancelAnimationFrame(targetFrame);
                targetFrame = 0;
                updateTarget(pointer.clientX, pointer.clientY);
            }
            cleanup();
            if (pointer.type !== 'pointercancel' && moved && target) onMoveItem(id, target);
            setDraggingId(null);
            setDropTarget(null);
        };
        const cleanup = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', finish);
            window.removeEventListener('pointercancel', finish);
            if (targetFrame) window.cancelAnimationFrame(targetFrame);
            dragPreview?.remove();
            cleanupRef.current = null;
        };
        cleanupRef.current = cleanup;
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', finish);
    }, [canvasRef, items, movable, onMoveItem, setDropTarget, targetAt]);

    const startResize = useCallback((event: ReactPointerEvent<HTMLElement>, id: string, handle: ResizeHandle) => {
        if (!resizable || event.button !== 0) return;
        const item = items.find((entry) => entry.id === id);
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        cleanupRef.current?.();
        const startX = event.clientX;
        const startY = event.clientY;
        const pointerId = event.pointerId;
        const side = handle === 'right' || handle === 'bottom-right' ? 'right' : 'left';
        const horizontal = handle !== 'bottom';
        const vertical = handle.startsWith('bottom');
        const row = arrangeBoardRows(items, layoutWidth, columns, unitWidth).find((entry) => entry.items.some((member) => member.id === id));
        const index = row?.items.findIndex((member) => member.id === id) ?? -1;
        const neighbor = horizontal ? row?.items[index + (side === 'left' ? 1 : -1)] : undefined;
        const maxWidth = boardZoom < 1 ? Math.floor(layoutWidth * BOARD_BASE_WIDTH / unitWidth) : undefined;
        const outerLimit = boardOuterWidthLimit(row, id, layoutWidth, unitWidth);
        let preview: ResizePreview = { id, w: item.w, h: item.h, neighborId: neighbor?.id, neighborW: neighbor?.w };
        const move = (pointer: PointerEvent) => {
            if (pointer.pointerId !== pointerId) return;
            const deltaX = (side === 'left' ? startX - pointer.clientX : pointer.clientX - startX) / boardZoom * BOARD_BASE_WIDTH / unitWidth;
            const requestedWidth = item.w + deltaX;
            const paired = horizontal && neighbor ? resizeBoardPair(item.w, neighbor.w, requestedWidth, unitWidth, columns, maxWidth) : null;
            const nextWidth = horizontal ? paired?.width ?? clampBoardWidth(requestedWidth, unitWidth, columns, outerLimit) : item.w;
            const nextHeight = vertical ? clampBoardHeight(item.h + (pointer.clientY - startY) / boardZoom) : item.h;
            const nextNeighborWidth = paired?.neighborWidth ?? neighbor?.w;
            if (preview.w === nextWidth && preview.h === nextHeight && preview.neighborW === nextNeighborWidth) return;
            preview = { id, w: nextWidth, h: nextHeight, neighborId: neighbor?.id, neighborW: nextNeighborWidth };
            setResizePreview(preview);
        };
        const finish = (pointer: PointerEvent) => {
            if (pointer.pointerId !== pointerId) return;
            cleanup();
            setResizePreview(null);
            if (pointer.type === 'pointercancel') return;
            if (preview.w !== item.w || preview.h !== item.h) onUpdateItem(id, { w: preview.w, h: preview.h });
            if (neighbor && preview.neighborW !== neighbor.w) onUpdateItem(neighbor.id, { w: preview.neighborW });
        };
        const cleanup = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', finish);
            window.removeEventListener('pointercancel', finish);
            cleanupRef.current = null;
        };
        cleanupRef.current = cleanup;
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', finish);
    }, [boardZoom, columns, items, layoutWidth, onUpdateItem, resizable, unitWidth]);

    return { draggingId, dropTarget, resizePreview, startMove, startResize, targetAt, setDropTarget };
}
