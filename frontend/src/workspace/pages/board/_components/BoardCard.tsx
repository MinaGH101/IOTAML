import { Download, GripHorizontal, Maximize2, X } from 'lucide-react';
import { memo, type KeyboardEvent, type PointerEvent } from 'react';
import { downloadOutput, OutputBody } from '../../../../features/results/components/ResultsPanel';
import type { AnalysisBoardItem } from '../../../_model/board';
import type { Output } from '../../../_model/output';
import type { ResizeHandle } from '../_hooks/useBoardCardInteractions';
import { ZoomControls } from './ZoomControls';

export type FocusedOutput = { output: Output; index: number; title: string };
type Props = {
    item: AnalysisBoardItem;
    output: Output | null | undefined;
    stale: boolean;
    runId?: number;
    editing: boolean;
    movable: boolean;
    resizable: boolean;
    active: boolean;
    dragging: boolean;
    resizing?: boolean;
    zoom: number;
    onZoomChange: (id: string, value: number) => void;
    onRemoveItem: (id: string) => void;
    onFocus: (focused: FocusedOutput) => void;
    onStartMove: (event: PointerEvent<HTMLElement>, id: string) => void;
    onStartResize: (event: PointerEvent<HTMLElement>, id: string, handle: ResizeHandle) => void;
    onMoveKey: (id: string, direction: -1 | 1) => void;
    onResizeKey: (id: string, key: string, side: 'left' | 'right') => void;
};

export const BoardCard = memo(function BoardCard({ item, output, stale, runId, editing, movable, resizable, active, dragging, resizing, zoom, onZoomChange, onRemoveItem, onFocus, onStartMove, onStartResize, onMoveKey, onResizeKey }: Props) {
    const title = item.sourceLabel?.trim() || item.outputTitle;
    const subtitle = item.sourceTypeLabel?.trim() || item.outputKind || (stale ? 'نیازمند اجرای دوباره' : runId ? `Run #${runId}` : 'خروجی');
    const moveByKeyboard = (event: KeyboardEvent<HTMLElement>) => {
        if (!movable || event.target !== event.currentTarget || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        onMoveKey(item.id, event.key === 'ArrowUp' ? -1 : 1);
    };
    const resizeByKeyboard = (event: KeyboardEvent<HTMLElement>, side: 'left' | 'right') => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        onResizeKey(item.id, event.key, side);
    };
    return <article className={`analysis-board-card workflow-shell-card ${stale ? 'stale' : ''} ${dragging ? 'is-dragging' : ''} ${resizing ? 'is-resizing' : ''}`} data-board-item-id={item.id}>
      <div className={`analysis-board-card-head ${movable ? 'is-movable' : ''}`} role={movable ? 'group' : undefined} tabIndex={movable ? 0 : undefined} aria-label={movable ? `جابه‌جایی ${title} با کشیدن یا کلیدهای بالا و پایین` : undefined} onPointerDown={(event) => onStartMove(event, item.id)} onKeyDown={moveByKeyboard} title={movable ? 'برای جابه‌جایی بکشید؛ میان دو ردیف رها کنید تا یک ردیف جدید بسازید' : undefined}>
        {movable && <GripHorizontal className="analysis-board-drag-cue" size={16} aria-hidden="true"/>}
        <div className="analysis-board-card-title"><b title={title}>{title}</b><span title={subtitle}>{subtitle}</span></div>
        <div className="analysis-board-card-actions">
          <ZoomControls value={zoom} onChange={(value) => onZoomChange(item.id, value)} label={`بزرگ‌نمایی ${title}`} compact/>
          {editing && <button className="tiny-action icon-action" type="button" onClick={() => onRemoveItem(item.id)} title="حذف از داشبورد" aria-label="حذف از داشبورد"><X size={15}/></button>}
          {output && <button className="tiny-action icon-action" type="button" onClick={() => downloadOutput(output, item.outputIndex)} title="دانلود" aria-label="دانلود"><Download size={15}/></button>}
          {output && <button className="tiny-action icon-action" type="button" onClick={() => onFocus({ output, index: item.outputIndex, title })} title="بزرگ‌نمایی" aria-label="بزرگ‌نمایی"><Maximize2 size={15}/></button>}
        </div>
      </div>
      <div className="analysis-board-card-body">
        <div className="analysis-board-card-content" style={{ zoom }}>
          {output && active ? <OutputBody output={output} collectionMode active/> : output ? <div className="output-suspended-placeholder" aria-hidden="true"/> : <div className="empty-state small">این خروجی در اجرای فعلی پیدا نشد. Workflow را Run کنید.</div>}
        </div>
      </div>
      {resizable && <>
        <span className="analysis-board-resize-edge horizontal-left" role="separator" aria-orientation="vertical" aria-label="برای تغییر عرض این کارت و کارت کناری، لبه چپ را بکشید" onPointerDown={(event) => onStartResize(event, item.id, 'left')}/>
        <span className="analysis-board-resize-edge horizontal-right" role="separator" aria-orientation="vertical" aria-label="برای تغییر عرض این کارت و کارت کناری، لبه راست را بکشید" onPointerDown={(event) => onStartResize(event, item.id, 'right')}/>
        <span className="analysis-board-resize-edge vertical" role="separator" aria-orientation="horizontal" aria-label="برای تغییر ارتفاع، لبه پایین را بکشید" onPointerDown={(event) => onStartResize(event, item.id, 'bottom')}/>
        <span className="analysis-board-resize-handle bottom-left" role="separator" tabIndex={0} aria-label="تغییر عرض دو کارت کنار هم و ارتفاع این کارت از گوشه چپ" onPointerDown={(event) => onStartResize(event, item.id, 'bottom-left')} onKeyDown={(event) => resizeByKeyboard(event, 'left')}/>
        <span className="analysis-board-resize-handle bottom-right" role="separator" tabIndex={0} aria-label="تغییر عرض دو کارت کنار هم و ارتفاع این کارت از گوشه راست" onPointerDown={(event) => onStartResize(event, item.id, 'bottom-right')} onKeyDown={(event) => resizeByKeyboard(event, 'right')}/>
      </>}
    </article>;
});
