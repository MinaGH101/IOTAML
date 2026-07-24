import { Download, Move, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { downloadOutput, normalizeOutputs, OutputBody } from '../../_components/ResultsPanel';
import type { AnalysisBoardItem, AnalysisBoardTab, BoardViewport } from '../../_model/board';
import { boardOutputTitle, resolveBoardItems } from '../../_model/boardOutputs';
import type { Run } from '../../../shared/_types';
import { BoardCard, type FocusedOutput } from './_components/BoardCard';
import { BoardTabs } from './_components/BoardControls';
import { useBoardViewport } from './_hooks/useBoardViewport';

type BoardPageProps = {
  tabs: AnalysisBoardTab[];
  activeBoardId: string;
  items: AnalysisBoardItem[];
  run: Run | null;
  workflowDirty: boolean;
  onSelectBoard: (id: string) => void;
  onCreateBoard: () => void;
  onUpdateItem: (id: string, patch: Partial<AnalysisBoardItem>) => void;
  onRemoveItem: (id: string) => void;
  onDuplicateItem: (item: AnalysisBoardItem) => void;
  onViewportChange: (boardId: string, viewport: BoardViewport) => void;
  readOnly?: boolean;
};

export function BoardPage({
  tabs,
  activeBoardId,
  items,
  run,
  workflowDirty,
  onSelectBoard,
  onCreateBoard,
  onAddOutput,
  onUpdateItem,
  onRemoveItem,
  onDuplicateItem,
  onViewportChange,
  readOnly = false,
}: BoardPageProps) {
  const [focusedOutput, setFocusedOutput] = useState<FocusedOutput | null>(null);
  const outputs = useMemo(() => normalizeOutputs(run, null), [run]);
  const resolvedItems = useMemo(
    () => resolveBoardItems(items, outputs, workflowDirty),
    [items, outputs, workflowDirty],
  );
  const {
    canvasRef,
    worldRef,
    startPan,
    getViewportScale,
  } = useBoardViewport({ tabs, activeBoardId, onViewportChange });

  useEffect(() => {
    if (workflowDirty || run?.status !== 'succeeded' || !run.id) return;
    resolvedItems.forEach(({ item, currentOutput }) => {
      if (!currentOutput || item.runId === run.id) return;
      onUpdateItem(item.id, {
        snapshot: currentOutput,
        runId: run.id,
        outputKind: String(currentOutput.kind || item.outputKind || 'json'),
        outputTitle: boardOutputTitle(currentOutput, item.outputIndex),
      });
    });
  }, [onUpdateItem, resolvedItems, run?.id, run?.status, workflowDirty]);

  return (
    <div className="analysis-board" dir="rtl">
      <BoardTabs
        tabs={tabs}
        activeBoardId={activeBoardId}
        readOnly={readOnly}
        onSelectBoard={onSelectBoard}
        onCreateBoard={onCreateBoard}
      />

      <div className="analysis-board-canvas" ref={canvasRef} onPointerDown={startPan}>
        {items.length === 0 && (
          <div className="analysis-board-empty workflow-shell-card">
            <b>این برد هنوز خالی است.</b>
            <span>از پنل خروجی سمت راست، نتیجه‌ها را به این برد اضافه کنید.</span>
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
              readOnly={readOnly}
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
