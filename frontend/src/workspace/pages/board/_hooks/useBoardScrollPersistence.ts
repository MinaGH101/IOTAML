import { useCallback, useEffect, useRef, type RefObject, type UIEvent } from 'react';
import type { BoardViewport } from '../../../_model/board';

type Options = {
    activeBoardId: string;
    viewport: BoardViewport;
    canvasRef: RefObject<HTMLDivElement | null>;
    contentKey: string;
    onUpdateViewport: (id: string, patch: Partial<BoardViewport>) => void;
};

/**
 * Keep only the current tab's scroll position in the persisted board model.
 * Scrolling stays imperative and writes at most once per short idle period,
 * so it neither re-renders cards nor creates an autosave for every scroll event.
 */
export function useBoardScrollPersistence({ activeBoardId, viewport, canvasRef, contentKey, onUpdateViewport }: Options) {
    const pendingRef = useRef<{ id: string; y: number } | null>(null);
    const timerRef = useRef(0);

    const flush = useCallback(() => {
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = 0;
        }
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending)
            onUpdateViewport(pending.id, { y: pending.y });
    }, [onUpdateViewport]);

    useEffect(() => () => flush(), [activeBoardId, flush]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const frame = window.requestAnimationFrame(() => {
            const maxScroll = Math.max(0, canvas.scrollHeight - canvas.clientHeight);
            canvas.scrollTop = Math.min(Math.max(0, viewport.y), maxScroll);
        });
        return () => window.cancelAnimationFrame(frame);
    }, [activeBoardId, canvasRef, contentKey, viewport.y]);

    const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
        const y = event.currentTarget.scrollTop;
        const pending = pendingRef.current;
        if (pending?.id === activeBoardId && Math.abs(pending.y - y) < 1)
            return;
        pendingRef.current = { id: activeBoardId, y };
        if (timerRef.current)
            return;
        timerRef.current = window.setTimeout(flush, 220);
    }, [activeBoardId, flush]);

    return { onScroll };
}
