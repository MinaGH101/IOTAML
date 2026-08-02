import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export type NodeDialogColumn = 'output' | 'settings' | 'input';
export type NodeDialogColumnWidths = Record<NodeDialogColumn, number>;

export function useResizableColumns() {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState<NodeDialogColumnWidths>({ output: 32, settings: 36, input: 32 });
  const beginResize = useCallback((leftKey: NodeDialogColumn, rightKey: NodeDialogColumn, event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const grid = gridRef.current;
    if (!grid) return;
    const startX = event.clientX;
    const totalWidth = grid.getBoundingClientRect().width;
    const startLeft = (columns[leftKey] / 100) * totalWidth;
    const startRight = (columns[rightKey] / 100) * totalWidth;
    const minWidth = Math.min(320, totalWidth * 0.22);
    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextLeft = Math.max(minWidth, startLeft + delta);
      const nextRight = Math.max(minWidth, startRight - delta);
      const locked = totalWidth - startLeft - startRight;
      const scale = (totalWidth - locked) / (nextLeft + nextRight);
      setColumns((current) => ({ ...current, [leftKey]: ((nextLeft * scale) / totalWidth) * 100, [rightKey]: ((nextRight * scale) / totalWidth) * 100 }));
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.classList.remove('n8n-resizing-columns');
    };
    document.body.classList.add('n8n-resizing-columns');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [columns]);
  return { gridRef, columns, beginResize };
}
