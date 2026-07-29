import {
  useCallback,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { BoardViewport } from '../../../_model/board';
import { loadCanvasViewport, saveCanvasViewport } from '../../../_model/viewportStorage';
import { clamp, setBoardInteractionActive } from '../_utils/boardInteraction';

function zoomAt(
  viewport: BoardViewport,
  nextScale: number,
  originX: number,
  originY: number,
): BoardViewport {
  const scale = clamp(nextScale, 0.35, 2.25);
  const worldX = (originX - viewport.x) / viewport.scale;
  const worldY = (originY - viewport.y) / viewport.scale;
  return {
    scale,
    x: originX - worldX * scale,
    y: originY - worldY * scale,
  };
}

function restoreViewport(storageKey: string, fallback: BoardViewport): BoardViewport {
  const stored = loadCanvasViewport(storageKey, {
    x: fallback.x,
    y: fallback.y,
    zoom: fallback.scale,
  });
  return { x: stored.x, y: stored.y, scale: stored.zoom };
}

export function useBoardViewport({
  activeBoardId,
  initialViewport,
  storageScope,
}: {
  activeBoardId: string;
  initialViewport: BoardViewport;
  storageScope: string;
}) {
  const storageKey = `${storageScope}:board:${activeBoardId}`;
  const initial = restoreViewport(storageKey, initialViewport);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<BoardViewport>(initial);
  const activeBoardIdRef = useRef(activeBoardId);
  const initialViewportRef = useRef(initialViewport);
  const storageScopeRef = useRef(storageScope);
  const transformFrameRef = useRef(0);
  const persistTimerRef = useRef(0);
  initialViewportRef.current = initialViewport;
  storageScopeRef.current = storageScope;

  const renderViewport = useCallback(() => {
    transformFrameRef.current = 0;
    const world = worldRef.current;
    if (!world) return;
    const viewport = viewportRef.current;
    world.style.transform = `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`;
  }, []);

  const scheduleRender = useCallback(() => {
    if (!transformFrameRef.current) {
      transformFrameRef.current = window.requestAnimationFrame(renderViewport);
    }
  }, [renderViewport]);

  const commitViewport = useCallback((boardId: string, viewport: BoardViewport) => {
    saveCanvasViewport(`${storageScopeRef.current}:board:${boardId}`, {
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.scale,
    });
  }, []);

  const cancelPendingCommit = useCallback(() => {
    if (!persistTimerRef.current) return;
    window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = 0;
  }, []);

  const scheduleCommit = useCallback(() => {
    cancelPendingCommit();
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = 0;
      commitViewport(activeBoardIdRef.current, viewportRef.current);
    }, 300);
  }, [cancelPendingCommit, commitViewport]);

  const applyViewport = useCallback((next: BoardViewport) => {
    viewportRef.current = next;
    scheduleRender();
    scheduleCommit();
  }, [scheduleCommit, scheduleRender]);

  useLayoutEffect(() => {
    renderViewport();
    return () => {
      cancelPendingCommit();
      if (transformFrameRef.current) window.cancelAnimationFrame(transformFrameRef.current);
      commitViewport(activeBoardIdRef.current, viewportRef.current);
      setBoardInteractionActive(false);
    };
  }, [cancelPendingCommit, commitViewport, renderViewport]);

  useLayoutEffect(() => {
    if (activeBoardIdRef.current === activeBoardId) return;
    cancelPendingCommit();
    commitViewport(activeBoardIdRef.current, viewportRef.current);
    activeBoardIdRef.current = activeBoardId;
    const next = restoreViewport(
      `${storageScope}:board:${activeBoardId}`,
      initialViewportRef.current,
    );
    viewportRef.current = next;
    renderViewport();
  }, [activeBoardId, cancelPendingCommit, commitViewport, renderViewport, storageScope]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const handleWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.analysis-board-card-body, .analysis-output-picker, .analysis-board-toolbar-direct')) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const originX = event.clientX - rect.left;
      const originY = event.clientY - rect.top;
      const current = viewportRef.current;
      if (event.ctrlKey || event.metaKey) {
        const zoomDelta = Math.exp(-event.deltaY * 0.0015);
        applyViewport(zoomAt(current, current.scale * zoomDelta, originX, originY));
        return;
      }
      const panX = event.shiftKey ? event.deltaY : event.deltaX;
      const panY = event.shiftKey ? 0 : event.deltaY;
      applyViewport({ ...current, x: current.x - panX, y: current.y - panY });
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [applyViewport]);

  const startPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || target.closest('.analysis-board-card, .analysis-output-picker, .analysis-board-empty, .analysis-board-toolbar-direct, button, input, textarea, select')) return;
    event.preventDefault();
    const canvas = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...viewportRef.current };
    setBoardInteractionActive(true);
    try {
      canvas.setPointerCapture(pointerId);
    } catch {
      // Window listeners provide pointer-capture fallback.
    }
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      applyViewport({
        ...start,
        x: start.x + moveEvent.clientX - startX,
        y: start.y + moveEvent.clientY - startY,
      });
    };
    const finish = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      cancelPendingCommit();
      commitViewport(activeBoardIdRef.current, viewportRef.current);
      setBoardInteractionActive(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }, [applyViewport, cancelPendingCommit, commitViewport]);

  const getViewportScale = useCallback(() => viewportRef.current.scale, []);
  return {
    canvasRef,
    worldRef,
    startPan,
    getViewportScale,
  };
}
