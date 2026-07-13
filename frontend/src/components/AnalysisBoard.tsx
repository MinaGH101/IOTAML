import { Copy, Download, GripHorizontal, Maximize2, Minus, Move, Pencil, Plus, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { downloadOutput, normalizeOutputs, OutputBody, type Output } from './ResultsPanel';
import type { Run } from '../types';

export type AnalysisBoardItem = {
  id: string;
  nodeId: string | null;
  outputIndex: number;
  outputTitle: string;
  outputKind: string;
  sourceLabel?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  runId?: number | null;
  snapshot?: Output;
  createdAt: string;
};

export type AnalysisBoardTab = {
  id: string;
  name: string;
  items: AnalysisBoardItem[];
  createdAt: string;
};

type AnalysisBoardProps = {
  tabs: AnalysisBoardTab[];
  activeBoardId: string;
  items: AnalysisBoardItem[];
  run: Run | null;
  busy: boolean;
  workflowDirty: boolean;
  onClose: () => void;
  onRun: () => void;
  onSelectBoard: (id: string) => void;
  onCreateBoard: () => void;
  onRenameBoard: (id: string, name: string) => void;
  onRemoveBoard: (id: string) => void;
  onAddOutput: (output: Output, outputIndex: number) => void;
  onUpdateItem: (id: string, patch: Partial<AnalysisBoardItem>) => void;
  onRemoveItem: (id: string) => void;
  onDuplicateItem: (item: AnalysisBoardItem) => void;
  onClear: () => void;
};

type BoardViewport = { x: number; y: number; scale: number };
type FocusedOutput = { output: Output; index: number; title: string };

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
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function outputTitle(output: Output, index: number) {
  const base = String(output.title || `خروجی ${index + 1}`);
  const source = String(output.source_label || output.branch || '').trim();
  return source ? `${base} · ${source}` : base;
}

function outputKey(output: Output) {
  return [output.node_id || '', output.title || '', output.kind || '', output.source_label || '', output.branch || '', output.path_index || ''].map(String).join('::');
}

function buildOutputLookup(outputs: Output[]) {
  const byNode = new Map<string, Output[]>();
  outputs.forEach((output) => {
    const nodeId = String(output.node_id || '');
    const values = byNode.get(nodeId) || [];
    values.push(output);
    if (Array.isArray(output.plots)) values.push(...(output.plots as Output[]));
    byNode.set(nodeId, values);
  });
  return byNode;
}

function findCurrentOutput(item: AnalysisBoardItem, lookup: Map<string, Output[]>) {
  const searchable = lookup.get(String(item.nodeId || '')) || [];
  const exact = searchable.find((output) => String(output.title || '') === item.outputTitle || outputTitle(output, item.outputIndex) === item.outputTitle);
  if (exact) return exact;
  const sameKind = searchable.filter((output) => String(output.kind || 'json') === item.outputKind);
  return sameKind[item.outputIndex] || searchable[item.outputIndex] || null;
}

function zoomAt(viewport: BoardViewport, nextScale: number, originX: number, originY: number): BoardViewport {
  const scale = clamp(nextScale, 0.35, 2.25);
  const worldX = (originX - viewport.x) / viewport.scale;
  const worldY = (originY - viewport.y) / viewport.scale;
  return {
    scale,
    x: originX - worldX * scale,
    y: originY - worldY * scale,
  };
}

function setCardInteractionState(active: boolean) {
  document.documentElement.classList.toggle('analysis-board-interacting', active);
}

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
  let latest = { x: start.x, y: start.y, w: start.w, h: start.h };
  let frame = 0;
  setCardInteractionState(true);

  try {
    handle.setPointerCapture(pointerId);
  } catch {
    // Window listeners remain the fallback.
  }

  const render = () => {
    frame = 0;
    if (action === 'move') {
      card.style.transform = `translate3d(${latest.x - start.x}px, ${latest.y - start.y}px, 0)`;
      return;
    }
    card.style.width = `${latest.w}px`;
    card.style.height = `${latest.h}px`;
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
    setCardInteractionState(false);
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
}

const BoardCard = memo(function BoardCard({
  item,
  output,
  stale,
  runId,
  getViewportScale,
  onUpdateItem,
  onRemoveItem,
  onDuplicateItem,
  onFocus,
}: BoardCardProps) {
  return (
    <article
      className={`analysis-board-card workflow-shell-card ${stale ? 'stale' : ''}`}
      data-board-item-id={item.id}
      style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
    >
      <div
        className="analysis-board-card-head"
        onPointerDown={(event) => startBoardPointerAction(event, item, 'move', getViewportScale, onUpdateItem)}
      >
        <GripHorizontal size={14} />
        <div>
          <b>{item.outputTitle}</b>
          <span>{item.outputKind} · {item.nodeId || 'node'} {stale ? '· قدیمی/نیازمند Run' : `· Run #${runId}`}</span>
        </div>
        {output && <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => downloadOutput(output, item.outputIndex)} title="Download"><Download size={12} /></button>}
        {output && <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => onFocus({ output, index: item.outputIndex, title: item.outputTitle })} title="Maximize"><Maximize2 size={12} /></button>}
        <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => onDuplicateItem(item)} title="Duplicate"><Copy size={12} /></button>
        <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => onRemoveItem(item.id)} title="Remove"><X size={12} /></button>
      </div>
      <div className="analysis-board-card-body">
        {output ? <OutputBody output={output} /> : <div className="empty-state small">این خروجی در اجرای فعلی پیدا نشد. Workflow را Run کنید.</div>}
      </div>
      <div
        className="analysis-board-resize"
        onPointerDown={(event) => startBoardPointerAction(event, item, 'resize', getViewportScale, onUpdateItem)}
      />
    </article>
  );
});

export function AnalysisBoard({
  tabs,
  activeBoardId,
  items,
  run,
  busy,
  workflowDirty,
  onClose,
  onRun,
  onSelectBoard,
  onCreateBoard,
  onRenameBoard,
  onRemoveBoard,
  onAddOutput,
  onUpdateItem,
  onRemoveItem,
  onDuplicateItem,
  onClear,
}: AnalysisBoardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [focusedOutput, setFocusedOutput] = useState<FocusedOutput | null>(null);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingBoardName, setEditingBoardName] = useState('');
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<BoardViewport>({ x: 0, y: 0, scale: 1 });
  const transformFrameRef = useRef(0);

  const outputs = useMemo(() => normalizeOutputs(run, null), [run]);
  const outputLookup = useMemo(() => buildOutputLookup(outputs), [outputs]);
  const pinnedKeys = useMemo(() => new Set(items.map((item) => item.snapshot ? outputKey(item.snapshot) : `${item.nodeId}::${item.outputTitle}::${item.outputKind}`)), [items]);
  const resolvedItems = useMemo(() => items.map((item) => {
    const currentOutput = findCurrentOutput(item, outputLookup);
    return {
      item,
      output: currentOutput || item.snapshot,
      stale: workflowDirty || !currentOutput,
    };
  }), [items, outputLookup, workflowDirty]);

  const renderViewport = useCallback(() => {
    transformFrameRef.current = 0;
    const world = worldRef.current;
    if (!world) return;
    const value = viewportRef.current;
    world.style.transform = `translate3d(${value.x}px, ${value.y}px, 0) scale(${value.scale})`;
  }, []);

  const scheduleViewportRender = useCallback(() => {
    if (!transformFrameRef.current) transformFrameRef.current = window.requestAnimationFrame(renderViewport);
  }, [renderViewport]);

  useEffect(() => {
    renderViewport();
    return () => {
      if (transformFrameRef.current) window.cancelAnimationFrame(transformFrameRef.current);
      setCardInteractionState(false);
    };
  }, [renderViewport]);

  const applyViewport = useCallback((next: BoardViewport, updateZoomLabel = false) => {
    viewportRef.current = next;
    scheduleViewportRender();
    if (updateZoomLabel) {
      const nextPercent = Math.round(next.scale * 100);
      setZoomPercent((current) => current === nextPercent ? current : nextPercent);
    }
  }, [scheduleViewportRender]);

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
    setCardInteractionState(true);

    try {
      canvas.setPointerCapture(pointerId);
    } catch {
      // Window listeners remain the fallback.
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
      setCardInteractionState(false);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }, [applyViewport]);

  const beginRename = (tab: AnalysisBoardTab) => {
    setEditingBoardId(tab.id);
    setEditingBoardName(tab.name);
  };

  const finishRename = () => {
    const name = editingBoardName.trim();
    if (editingBoardId && name) onRenameBoard(editingBoardId, name);
    setEditingBoardId(null);
    setEditingBoardName('');
  };

  return (
    <div className="analysis-board" dir="rtl">
      <div className="analysis-board-toolbar analysis-board-toolbar-direct workflow-shell-card">
        {/* <div className="analysis-board-toolbar-main">
          <div className="analysis-board-title">
            <b>Analysis Board</b>
            <span>مقایسه خروجی‌های چند نود در بردهای جدا</span>
          </div>
          <div className="analysis-board-actions">
            {workflowDirty && <span className="analysis-board-dirty">نتایج ممکن است قدیمی باشند.</span>}
            <div className="analysis-board-zoom-pill" title="Board zoom">
              <button type="button" onClick={() => setZoom(viewportRef.current.scale - 0.05)}><Minus size={12} /></button>
              <span>{zoomPercent}%</span>
              <button type="button" onClick={() => setZoom(viewportRef.current.scale + 0.05)}><Plus size={12} /></button>
              <button type="button" onClick={resetViewport}><RotateCcw size={12} /></button>
            </div>
            <button className="tiny-action" type="button" onClick={() => setPickerOpen((value) => !value)} title="افزودن خروجی"><Plus size={13} />خروجی</button>
            <button className="tiny-action" type="button" disabled={busy} onClick={onRun} title="اجرای دوباره"><RefreshCw size={13} className={busy ? 'spin' : ''} />Run</button>
            <button className="tiny-action icon-action" type="button" disabled={items.length === 0} onClick={onClear} title="پاک کردن برد"><Trash2 size={13} /></button>
            <button className="icon-button icon-only" type="button" onClick={onClose} title="بازگشت به Workflow"><X size={14} /></button>
          </div>
        </div> */}

        <div className="analysis-board-tabs-row" aria-label="بردهای تحلیل">
          <div className="analysis-board-tabs-scroll">
            {tabs.map((tab) => (
              <div className={`analysis-board-tab ${tab.id === activeBoardId ? 'active' : ''}`} key={tab.id}>
                {editingBoardId === tab.id ? (
                  <input
                    autoFocus
                    value={editingBoardName}
                    onChange={(event) => setEditingBoardName(event.target.value)}
                    onBlur={finishRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') finishRename();
                      if (event.key === 'Escape') { setEditingBoardId(null); setEditingBoardName(''); }
                    }}
                    aria-label="نام برد"
                  />
                ) : (
                  <button type="button" className="analysis-board-tab-select" onClick={() => onSelectBoard(tab.id)} onDoubleClick={() => beginRename(tab)}>
                    <span>{tab.name}</span>
                    <small>{tab.items.length.toLocaleString('fa-IR')}</small>
                  </button>
                )}
                {tab.id === activeBoardId && editingBoardId !== tab.id && (
                  <button className="analysis-board-tab-action" type="button" onClick={() => beginRename(tab)} title="تغییر نام"><Pencil size={11} /></button>
                )}
                {tab.id !== 'analysis-board-main' && tab.id === activeBoardId && (
                  <button className="analysis-board-tab-action danger" type="button" onClick={() => onRemoveBoard(tab.id)} title="حذف برد"><X size={11} /></button>
                )}
              </div>
            ))}
          </div>
          <button className="analysis-board-add-tab" type="button" onClick={onCreateBoard} title="برد جدید"><Plus size={13} /></button>
        </div>
      </div>

      {pickerOpen && (
        <div className="analysis-output-picker workflow-shell-card">
          <div className="analysis-output-picker-head">
            <b>خروجی‌های قابل افزودن به برد فعال</b>
            <button className="tiny-action icon-action" type="button" onClick={() => setPickerOpen(false)}><X size={12} /></button>
          </div>
          <div className="analysis-output-picker-list">
            {!run && <div className="empty-state small">اول Workflow را اجرا کنید تا خروجی‌ها قابل انتخاب باشند.</div>}
            {run && outputs.length === 0 && <div className="empty-state small">خروجی قابل نمایش پیدا نشد.</div>}
            {outputs.map((output, index) => {
              const key = outputKey(output);
              return (
                <button className="analysis-output-choice" type="button" key={`${key}-${index}`} onClick={() => onAddOutput(output, index)}>
                  <span>{outputTitle(output, index)}</span>
                  <small>{String(output.kind || 'json')} · {String(output.node_id || 'node')}</small>
                  {pinnedKeys.has(key) && <em>روی این برد هست</em>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="analysis-board-canvas" ref={canvasRef} onPointerDown={startPan}>
        {items.length === 0 && (
          <div className="analysis-board-empty workflow-shell-card">
            <b>این برد هنوز خالی است.</b>
            <span>از پنل خروجی سمت راست یا دکمه «خروجی»، نتیجه‌ها را به این برد اضافه کنید.</span>
          </div>
        )}
        <div className="analysis-board-pan-hint"><Move size={12} /> drag empty board to pan · wheel to pan · Ctrl/Cmd + wheel to zoom</div>
        <div className="analysis-board-world" ref={worldRef}>
          {resolvedItems.map(({ item, output, stale }) => (
            <BoardCard
              key={item.id}
              item={item}
              output={output}
              stale={stale}
              runId={run?.id}
              getViewportScale={getViewportScale}
              onUpdateItem={onUpdateItem}
              onRemoveItem={onRemoveItem}
              onDuplicateItem={onDuplicateItem}
              onFocus={setFocusedOutput}
            />
          ))}
        </div>
      </div>

      {focusedOutput && createPortal(
        <div className="modal-backdrop workflow-shell-backdrop output-fullscreen-backdrop" onClick={() => setFocusedOutput(null)}>
          <div className="modal-card workflow-shell-popup output-fullscreen-card" onClick={(event) => event.stopPropagation()}>
            <div className="output-fullscreen-head">
              <h3>{focusedOutput.title}</h3>
              <div className="output-fullscreen-actions">
                <button className="tiny-action icon-action" title="دانلود" aria-label="دانلود" onClick={() => downloadOutput(focusedOutput.output, focusedOutput.index)}><Download size={13}/></button>
                <button className="modal-close" title="بستن" aria-label="بستن" onClick={() => setFocusedOutput(null)}><X size={16}/></button>
              </div>
            </div>
            <div className="output-fullscreen-body"><OutputBody output={focusedOutput.output} /></div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
