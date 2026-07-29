import { useCallback, useEffect, useRef } from 'react';
import type { WorkflowViewport } from '../../../_model/graph';
import { loadCanvasViewport, saveCanvasViewport } from '../../../_model/viewportStorage';

type SetViewport = (
  viewport: WorkflowViewport,
  options?: { duration?: number },
) => unknown;

export function usePersistentWorkflowViewport({
  storageScope,
  setViewport,
}: {
  storageScope: string;
  setViewport: SetViewport;
}) {
  const storageKey = `${storageScope}:workflow`;
  const viewportRef = useRef<WorkflowViewport>(
    loadCanvasViewport(storageKey, { x: 0, y: 0, zoom: 1 }),
  );
  const restoreFrameRef = useRef(0);

  const restore = useCallback((fallback: WorkflowViewport) => {
    const restored = loadCanvasViewport(storageKey, fallback);
    viewportRef.current = restored;
    if (restoreFrameRef.current) {
      window.cancelAnimationFrame(restoreFrameRef.current);
    }
    restoreFrameRef.current = window.requestAnimationFrame(() => {
      restoreFrameRef.current = 0;
      void setViewport(restored, { duration: 0 });
    });
  }, [setViewport, storageKey]);

  const update = useCallback((next: WorkflowViewport) => {
    viewportRef.current = next;
    saveCanvasViewport(storageKey, next);
  }, [storageKey]);

  useEffect(() => () => {
    if (restoreFrameRef.current) {
      window.cancelAnimationFrame(restoreFrameRef.current);
    }
  }, []);

  return { viewport: viewportRef.current, restore, update };
}
