import { Copy, Download, GripHorizontal, Maximize2, X } from 'lucide-react';
import { memo } from 'react';
import { downloadOutput, OutputBody } from '../../../../features/results/components/ResultsPanel';
import type { AnalysisBoardItem } from '../../../_model/board';
import type { Output } from '../../../_model/output';
import { startBoardPointerAction } from '../_utils/boardCardPointer';
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
    onSelectSourceNode: (nodeId: string) => void;
    onFocus: (focused: FocusedOutput) => void;
    readOnly: boolean;
    active: boolean;
};
export const BoardCard = memo(function BoardCard({ item, output, stale, runId, getViewportScale, onUpdateItem, onRemoveItem, onDuplicateItem, onSelectSourceNode, onFocus, readOnly, active, }: BoardCardProps) {
    const title = item.sourceLabel
        ? `${item.outputTitle}`
        : item.outputTitle;
    return (<article className={`analysis-board-card workflow-shell-card ${stale ? 'stale' : ''}`} data-board-item-id={item.id} style={{ left: item.x, top: item.y, width: item.w, height: item.h }} onClick={() => {
            if (item.nodeId)
                onSelectSourceNode(item.nodeId);
        }}>
      <div className="analysis-board-card-head" onPointerDown={(event) => {
            if (!readOnly)
                startBoardPointerAction(event, item, 'move', getViewportScale, onUpdateItem);
        }}>
        <GripHorizontal size={10}/>
        <div>
          <b>{title}</b>
          <span>
            {/* {item.outputKind} */}
            {stale ? ' قدیمی/نیازمند Run' : ` Run #${runId}`}</span>
        </div>
        {output && <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => downloadOutput(output, item.outputIndex)} title="Download"><Download size={12}/></button>}
        {output && <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => onFocus({ output, index: item.outputIndex, title })} title="Maximize"><Maximize2 size={12}/></button>}
        {!readOnly && <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => onDuplicateItem(item)} title="Duplicate"><Copy size={12}/></button>}
        {!readOnly && <button className="tiny-action icon-action" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => onRemoveItem(item.id)} title="Remove"><X size={12}/></button>}
      </div>
      <div className="analysis-board-card-body">
        {output && active
            ? <OutputBody output={output} collectionMode active/>
            : output
                ? <div className="output-suspended-placeholder" aria-hidden="true"/>
                : <div className="empty-state small">این خروجی در اجرای فعلی پیدا نشد. Workflow را Run کنید.</div>}
      </div>
      <div className="analysis-board-resize" onPointerDown={(event) => {
            if (!readOnly)
                startBoardPointerAction(event, item, 'resize', getViewportScale, onUpdateItem);
        }} aria-hidden={readOnly}/>
    </article>);
});
