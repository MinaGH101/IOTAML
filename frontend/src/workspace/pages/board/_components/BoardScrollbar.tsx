import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

type Metrics = { scrollTop: number; scrollHeight: number; clientHeight: number; trackHeight: number };

export function BoardScrollbar({ canvasRef, contentKey }: { canvasRef: RefObject<HTMLDivElement | null>; contentKey: string }) {
    const railRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ pointerId: number; grabOffset: number } | null>(null);
    const [metrics, setMetrics] = useState<Metrics>({ scrollTop: 0, scrollHeight: 0, clientHeight: 0, trackHeight: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        const rail = railRef.current;
        if (!canvas || !rail) return;
        const sync = () => setMetrics({ scrollTop: canvas.scrollTop, scrollHeight: canvas.scrollHeight, clientHeight: canvas.clientHeight, trackHeight: rail.clientHeight });
        sync();
        canvas.addEventListener('scroll', sync, { passive: true });
        const observer = new ResizeObserver(sync);
        observer.observe(canvas);
        observer.observe(rail);
        if (canvas.firstElementChild) observer.observe(canvas.firstElementChild);
        return () => { canvas.removeEventListener('scroll', sync); observer.disconnect(); };
    }, [canvasRef, contentKey]);

    const maxScroll = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
    const thumbHeight = maxScroll ? Math.min(metrics.trackHeight, Math.max(56, metrics.trackHeight * metrics.clientHeight / metrics.scrollHeight)) : metrics.trackHeight;
    const travel = Math.max(0, metrics.trackHeight - thumbHeight);
    const thumbTop = maxScroll ? metrics.scrollTop / maxScroll * travel : 0;
    const scrollFromPointer = (clientY: number, grabOffset: number) => {
        const canvas = canvasRef.current;
        const rail = railRef.current;
        if (!canvas || !rail || !maxScroll || !travel) return;
        const top = clientY - rail.getBoundingClientRect().top - grabOffset;
        canvas.scrollTop = Math.max(0, Math.min(1, top / travel)) * maxScroll;
    };
    const start = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!maxScroll || event.button !== 0) return;
        event.preventDefault();
        const railTop = railRef.current?.getBoundingClientRect().top || 0;
        const localY = event.clientY - railTop;
        const onThumb = localY >= thumbTop && localY <= thumbTop + thumbHeight;
        const grabOffset = onThumb ? localY - thumbTop : thumbHeight / 2;
        dragRef.current = { pointerId: event.pointerId, grabOffset };
        event.currentTarget.setPointerCapture(event.pointerId);
        scrollFromPointer(event.clientY, grabOffset);
    };
    const move = (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (drag?.pointerId === event.pointerId) scrollFromPointer(event.clientY, drag.grabOffset);
    };
    const stop = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    };
    return <div ref={railRef} className={`analysis-board-scroll-rail ${maxScroll ? '' : 'is-idle'}`} role="scrollbar" tabIndex={0} aria-label="پیمایش عمودی برد" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={Math.round(maxScroll)} aria-valuenow={Math.round(metrics.scrollTop)} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onKeyDown={(event) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const amount = event.key === 'PageDown' ? canvas.clientHeight : event.key === 'PageUp' ? -canvas.clientHeight : event.key === 'ArrowDown' ? 60 : event.key === 'ArrowUp' ? -60 : 0;
        if (amount) { event.preventDefault(); canvas.scrollTop += amount; }
        if (event.key === 'Home') { event.preventDefault(); canvas.scrollTop = 0; }
        if (event.key === 'End') { event.preventDefault(); canvas.scrollTop = maxScroll; }
    }}>
      <span className="analysis-board-scroll-thumb" style={{ height: thumbHeight, transform: `translateY(${thumbTop}px)` }}/>
    </div>;
}
