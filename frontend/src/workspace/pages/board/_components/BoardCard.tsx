import { Copy, Download, GripHorizontal, Maximize2, X } from 'lucide-react';
import { memo, type PointerEvent as ReactPointerEvent } from 'react';
import { downloadOutput, OutputBody } from '../../../_components/ResultsPanel';
import type { AnalysisBoardItem } from '../../../_model/board';
import type { Output } from '../../../_model/output';
import { clamp, setBoardInteractionActive } from '../_utils/boardInteraction';

export type FocusedOutput = {
  output: Output;
  index: number;
  title: string;
};

type BoardCardProps = {
  item: AnalysisBoardItem;
  output: Output | null | undefined;
  stale: boolean;
  runId?: number;
  getViewportScale: () => number;
  onUpdateItem: (id: string, patch: Partial<AnalysisBoardItem>) => void;
  onRemoveItem: (id: string) => void;
  onDuplicateItem: (item: AnalysisBoardItem) => void;
  onFocus: (focused: FocusedOutput) => void;
  readOnly: boolean;
};

function startBoardPointerAction(
  event: ReactPointerEvent<HTMLElement>,
  item: AnalysisBoardItem,
  action: 'move' | 'resize',
  getViewportScale: () => number,
  onUpdateItem: (id: string, patch: Partial<AnalysisBoardItem>) => void,
) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();

  const handle = event.currentTarget;
  const card = handle.closest<HTMLElement>('.analysis-board-card');
  if (!card) return;

  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  const start = { ...item };
  const latest = { x: start.x, y: start.y, w: start.w, h: start.h };
  let frame = 0;
  setBoardInteractionActive(true);

  try {
    handle.setPointerCapture(pointerId);
  } catch {
    // Window listeners provide pointer-capture fallback.
  }

  const render = () => {
    frame = 0;
    if (action === 'move') {
      card.style.transform = `translate3d(${latest.x - start.x}px, ${latest.y - start.y}px, 0)`;
    } else {
      card.style.width = `${latest.w}px`;
      card.style.height = `${latest.h}px`;
    }
  };

  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    const scale = Math.max(0.01, getViewportScale());
    const dx = (moveEvent.clientX - startX) / scale;
    const dy = (moveEvent.clientY - startY) / scale;
    if (action === 'move') {
      latest.x = clamp(start.x + dx, -4000, 8000);
      latest.y = clamp(start.y + dy, -4000, 8000);
    } else {
      latest.w = Math.max(180, start.w + dx);
      latest.h = Math.max(140, start.h + dy);
    }
    if (!frame) frame = window.requestAnimationFrame(render);
  };

  const finish = (upEvent: PointerEvent) => {
    if (upEvent.pointerId !== pointerId) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', finish);
    if (frame) window.cancelAnimationFrame(frame);

    if (action === 'move') {
      card.style.left = `${latest.x}px`;
      card.style.top = `${latest.y}px`;
      card.style.transform = '';
      onUpdateItem(item.id, { x: latest.x, y: latest.y });
    } else {
      onUpdateItem(item.id, { w: latest.w, h: latest.h });
    }
    setBoardInteractionActive(false);
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
}

export const BoardCard = memo(function BoardCard({
  item,
  output,
  stale,
  runId,
  getViewportScale,
  onUpdateItem,
  onRemoveItem,
  onDuplicateItem,
  onFocus,
  readOnly,
}: BoardCardProps) {
  const title = item.sourceLabel
    ? `${item.sourceLabel} · ${item.outputTitle}`
    : item.outputTitle;

  return (
    <article
      className={`analysis-board-card workflow-shell-card ${stale ? 'stale' : ''}`}
      data-board-item-id={item.id}
      style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
    >
      <div
        className="analysis-board-card-head"
        onPointerDown={(event) => {
          if (!readOnly) startBoardPointerAction(event, item, 'move', getViewportScale, onUpdateItem);
        }}
      >
        <GripHorizontal size={17}/>
        <div>
          <b>{title}</b>
          <span>{item.outputKind} · {item.nodeId || 'node'} {stale ? '· قدیمی/نیازمند Run' : `· Run #${runId}`}</span>
        </div>
        {output && <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => downloadOutput(output, item.outputIndex)} title="Download"><Download size={12} /></button>}
        {output && <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => onFocus({ output, index: item.outputIndex, title })} title="Maximize"><Maximize2 size={12} /></button>}
        {!readOnly && <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => onDuplicateItem(item)} title="Duplicate"><Copy size={12} /></button>}
        {!readOnly && <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => onRemoveItem(item.id)} title="Remove"><X size={12} /></button>}
      </div>
      <div className="analysis-board-card-body">
        {output
          ? <OutputBody output={output} />
          : <div className="empty-state small">این خروجی در اجرای فعلی پیدا نشد. Workflow را Run کنید.</div>}
      </div>
      <div
        className="analysis-board-resize"
        onPointerDown={(event) => {
          if (!readOnly) startBoardPointerAction(event, item, 'resize', getViewportScale, onUpdateItem);
        }}
        aria-hidden={readOnly}
      />
    </article>
  );
});
