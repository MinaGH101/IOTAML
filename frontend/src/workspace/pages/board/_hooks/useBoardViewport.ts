import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { AnalysisBoardTab, BoardViewport } from '../../../_model/board';
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

export function useBoardViewport({
  tabs,
  activeBoardId,
  onViewportChange,
}: {
  tabs: AnalysisBoardTab[];
  activeBoardId: string;
  onViewportChange: (boardId: string, viewport: BoardViewport) => void;
}) {
  const [zoomPercent, setZoomPercent] = useState(100);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<BoardViewport>({ x: 0, y: 0, scale: 1 });
  const viewportByBoardRef = useRef<Record<string, BoardViewport>>({});
  const activeBoardIdRef = useRef(activeBoardId);
  const transformFrameRef = useRef(0);
  const viewportPersistTimerRef = useRef(0);

  const renderViewport = useCallback(() => {
    transformFrameRef.current = 0;
    const world = worldRef.current;
    if (!world) return;
    const value = viewportRef.current;
    world.style.transform = `translate3d(${value.x}px, ${value.y}px, 0) scale(${value.scale})`;
  }, []);

  const scheduleViewportRender = useCallback(() => {
    if (!transformFrameRef.current) {
      transformFrameRef.current = window.requestAnimationFrame(renderViewport);
    }
  }, [renderViewport]);

  useEffect(() => {
    renderViewport();
    return () => {
      if (transformFrameRef.current) window.cancelAnimationFrame(transformFrameRef.current);
      if (viewportPersistTimerRef.current) window.clearTimeout(viewportPersistTimerRef.current);
      onViewportChange(activeBoardIdRef.current, { ...viewportRef.current });
      setBoardInteractionActive(false);
    };
  }, [onViewportChange, renderViewport]);

  const schedulePersistence = useCallback((boardId: string, viewport: BoardViewport) => {
    if (viewportPersistTimerRef.current) window.clearTimeout(viewportPersistTimerRef.current);
    viewportPersistTimerRef.current = window.setTimeout(() => {
      viewportPersistTimerRef.current = 0;
      onViewportChange(boardId, { ...viewport });
    }, 180);
  }, [onViewportChange]);

  const applyViewport = useCallback((next: BoardViewport, updateZoomLabel = false) => {
    viewportRef.current = next;
    viewportByBoardRef.current[activeBoardIdRef.current] = { ...next };
    scheduleViewportRender();
    schedulePersistence(activeBoardIdRef.current, next);
    if (updateZoomLabel) {
      const nextPercent = Math.round(next.scale * 100);
      setZoomPercent((current) => current === nextPercent ? current : nextPercent);
    }
  }, [schedulePersistence, scheduleViewportRender]);

  useEffect(() => {
    const previousId = activeBoardIdRef.current;
    viewportByBoardRef.current[previousId] = { ...viewportRef.current };
    if (previousId !== activeBoardId) {
      onViewportChange(previousId, { ...viewportRef.current });
    }
    activeBoardIdRef.current = activeBoardId;
    const persisted = tabs.find((tab) => tab.id === activeBoardId)?.viewport;
    const next = viewportByBoardRef.current[activeBoardId]
      || persisted
      || { x: 0, y: 0, scale: 1 };
    viewportRef.current = { ...next };
    viewportByBoardRef.current[activeBoardId] = { ...next };
    setZoomPercent(Math.round(next.scale * 100));
    scheduleViewportRender();
  }, [activeBoardId, onViewportChange, scheduleViewportRender, tabs]);

  useEffect(() => {
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
        applyViewport(zoomAt(current, current.scale * zoomDelta, originX, originY), true);
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
      setBoardInteractionActive(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }, [applyViewport]);

  const getViewportScale = useCallback(() => viewportRef.current.scale, []);
  const setZoom = useCallback((nextScale: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const originX = rect ? rect.width / 2 : window.innerWidth / 2;
    const originY = rect ? rect.height / 2 : window.innerHeight / 2;
    applyViewport(zoomAt(viewportRef.current, nextScale, originX, originY), true);
  }, [applyViewport]);
  const resetViewport = useCallback(() => {
    applyViewport({ x: 0, y: 0, scale: 1 }, true);
  }, [applyViewport]);

  return {
    canvasRef,
    worldRef,
    zoomPercent,
    setZoom,
    resetViewport,
    startPan,
    getViewportScale,
  };
}
