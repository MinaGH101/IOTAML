import { Copy, Download, GripHorizontal, Maximize2, Minus, Move, Plus, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
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

type AnalysisBoardProps = {
  items: AnalysisBoardItem[];
  run: Run | null;
  busy: boolean;
  workflowDirty: boolean;
  onClose: () => void;
  onRun: () => void;
  onAddOutput: (output: Output, outputIndex: number) => void;
  onUpdateItem: (id: string, patch: Partial<AnalysisBoardItem>) => void;
  onRemoveItem: (id: string) => void;
  onDuplicateItem: (item: AnalysisBoardItem) => void;
  onClear: () => void;
};

type BoardViewport = { x: number; y: number; scale: number };

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

function findCurrentOutput(item: AnalysisBoardItem, outputs: Output[]) {
  const nodeOutputs = outputs.filter((output) => String(output.node_id || '') === String(item.nodeId || ''));
  const childPlots = nodeOutputs.flatMap((output) => Array.isArray(output.plots) ? (output.plots as Output[]) : []);
  const searchable = [...nodeOutputs, ...childPlots];
  const exact = searchable.find((output) => String(output.title || '') === item.outputTitle || outputTitle(output, item.outputIndex) === item.outputTitle);
  if (exact) return exact;
  const sameKind = searchable.filter((output) => String(output.kind || 'json') === item.outputKind);
  return sameKind[item.outputIndex] || searchable[item.outputIndex] || null;
}

function startBoardPointerAction(
  event: ReactPointerEvent,
  item: AnalysisBoardItem,
  action: 'move' | 'resize',
  viewportScale: number,
  onUpdateItem: (id: string, patch: Partial<AnalysisBoardItem>) => void
) {
  event.preventDefault();
  event.stopPropagation();

  const startX = event.clientX;
  const startY = event.clientY;
  const start = { ...item };

  const move = (moveEvent: PointerEvent) => {
    const dx = (moveEvent.clientX - startX) / viewportScale;
    const dy = (moveEvent.clientY - startY) / viewportScale;

    if (action === 'move') {
      onUpdateItem(item.id, {
        x: clamp(start.x + dx, -4000, 8000),
        y: clamp(start.y + dy, -4000, 8000)
      });
      return;
    }

    onUpdateItem(item.id, {
      w: Math.max(180, start.w + dx),
      h: Math.max(140, start.h + dy)
    });
  };

  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function zoomAt(viewport: BoardViewport, nextScale: number, originX: number, originY: number): BoardViewport {
  const scale = clamp(nextScale, 0.35, 2.25);
  const worldX = (originX - viewport.x) / viewport.scale;
  const worldY = (originY - viewport.y) / viewport.scale;
  return {
    scale,
    x: originX - worldX * scale,
    y: originY - worldY * scale
  };
}

export function AnalysisBoard({ items, run, busy, workflowDirty, onClose, onRun, onAddOutput, onUpdateItem, onRemoveItem, onDuplicateItem, onClear }: AnalysisBoardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewport, setViewport] = useState<BoardViewport>({ x: 0, y: 0, scale: 1 });
  const [focusedOutput, setFocusedOutput] = useState<{ output: Output; index: number; title: string } | null>(null);
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setToolbarHost(document.getElementById('analysis-board-controls-host'));
  }, []);
  const outputs = useMemo(() => normalizeOutputs(run, null), [run]);
  const pinnedKeys = useMemo(() => new Set(items.map((item) => item.snapshot ? outputKey(item.snapshot) : `${item.nodeId}::${item.outputTitle}::${item.outputKind}`)), [items]);

  const setZoom = (nextScale: number) => {
    const rect = document.querySelector('.analysis-board-canvas')?.getBoundingClientRect();
    const originX = rect ? rect.width / 2 : window.innerWidth / 2;
    const originY = rect ? rect.height / 2 : window.innerHeight / 2;
    setViewport((value) => zoomAt(value, nextScale, originX, originY));
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const originX = event.clientX - rect.left;
    const originY = event.clientY - rect.top;
    if (event.ctrlKey || event.metaKey) {
      const zoomDelta = Math.exp(-event.deltaY * 0.0015);
      setViewport((value) => zoomAt(value, value.scale * zoomDelta, originX, originY));
      return;
    }
    const panX = event.shiftKey ? event.deltaY : event.deltaX;
    const panY = event.shiftKey ? 0 : event.deltaY;
    setViewport((value) => ({ ...value, x: value.x - panX, y: value.y - panY }));
  };

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || target.closest('.analysis-board-card, .analysis-output-picker, .analysis-board-empty, button, input, textarea, select')) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...viewport };

    const move = (moveEvent: PointerEvent) => {
      setViewport({ ...start, x: start.x + moveEvent.clientX - startX, y: start.y + moveEvent.clientY - startY });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="analysis-board" dir="rtl">
      {toolbarHost && createPortal(
        <div className="analysis-board-controls-content">
          <div className="analysis-board-toolbar workflow-shell-card">
            <div className="analysis-board-title">
              <b>Analysis Board</b>
              <span>مقایسه خروجی‌های چند نود</span>
            </div>
            <div className="analysis-board-actions">
              {workflowDirty && <span className="analysis-board-dirty">تنظیمات تغییر کرده؛ نتایج ممکن است قدیمی باشند.</span>}
              <div className="analysis-board-zoom-pill" title="Board zoom">
                    <button type="button" onClick={() => setZoom(viewport.scale - 0.05)}><Minus size={12} /></button>
                    <span>{Math.round(viewport.scale * 100)}%</span>
                    <button type="button" onClick={() => setZoom(viewport.scale + 0.05)}><Plus size={12} /></button>
                    <button type="button" onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}><RotateCcw size={12} /></button>
              </div>
              <button className="tiny-action" type="button" onClick={() => setPickerOpen((value) => !value)} title="افزودن خروجی"><Plus size={13} />افزودن خروجی</button>
              <button className="tiny-action" type="button" disabled={busy} onClick={onRun} title="اجرای دوباره"><RefreshCw size={13} className={busy ? 'spin' : ''} />Run</button>
              <button className="tiny-action" type="button" disabled={items.length === 0} onClick={onClear} title="پاک کردن برد"><Trash2 size={13} />پاک کردن</button>
              <button className="icon-button" type="button" onClick={onClose} title="بازگشت به Workflow"><X size={14} /></button>
            </div>
          </div>

          {pickerOpen && (
            <div className="analysis-output-picker workflow-shell-card">
              <div className="analysis-output-picker-head">
                    <b>خروجی‌های قابل افزودن</b>
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
                              {pinnedKeys.has(key) && <em>روی برد هست</em>}
                        </button>
                      );
                    })}
              </div>
            </div>
          )}

        </div>,
        toolbarHost
      )}

      <div className="analysis-board-canvas" onWheel={onWheel} onPointerDown={startPan}>
        {items.length === 0 && (
          <div className="analysis-board-empty workflow-shell-card">
            <b>هنوز چیزی روی برد نیست.</b>
            <span>از پنل خروجی یا دکمه «افزودن خروجی»، جدول‌ها و نمودارهای نودهای مختلف را برای مقایسه اضافه کنید.</span>
          </div>
        )}
        <div className="analysis-board-pan-hint"><Move size={12} /> drag empty board to pan · wheel to pan · Ctrl/Cmd + wheel to zoom</div>
        <div className="analysis-board-world" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}>
          {items.map((item) => {
            const currentOutput = findCurrentOutput(item, outputs);
            const output = currentOutput || item.snapshot;
            const stale = workflowDirty || !currentOutput;
            return (
              <article className={`analysis-board-card workflow-shell-card ${stale ? 'stale' : ''}`} key={item.id} style={{ left: item.x, top: item.y, width: item.w, height: item.h }}>
                <div className="analysis-board-card-head" onPointerDown={(event) => startBoardPointerAction(event, item, 'move', viewport.scale, onUpdateItem)}>
                  <GripHorizontal size={14} />
                  <div>
                    <b>{item.outputTitle}</b>
                    <span>{item.outputKind} · {item.nodeId || 'node'} {stale ? '· قدیمی/نیازمند Run' : `· Run #${run?.id}`}</span>
                  </div>
                  {output && <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => downloadOutput(output, item.outputIndex)} title="Download"><Download size={12} /></button>}
                  {output && <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setFocusedOutput({ output, index: item.outputIndex, title: item.outputTitle })} title="Maximize"><Maximize2 size={12} /></button>}
                  <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => onDuplicateItem(item)} title="Duplicate"><Copy size={12} /></button>
                  <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => onRemoveItem(item.id)} title="Remove"><X size={12} /></button>
                </div>
                <div className="analysis-board-card-body" onWheel={(event) => event.stopPropagation()}>
                  {output ? <OutputBody output={output} /> : <div className="empty-state small">این خروجی در اجرای فعلی پیدا نشد. Workflow را Run کنید.</div>}
                </div>
                <div className="analysis-board-resize" onPointerDown={(event) => startBoardPointerAction(event, item, 'resize', viewport.scale, onUpdateItem)} />
              </article>
            );
          })}
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
        document.body
      )}
    </div>
  );
}
