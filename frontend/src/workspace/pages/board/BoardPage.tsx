import { useEffect, useState } from 'react';
import type { AnalysisBoardItem, AnalysisBoardTab } from '../../_model/board';
import type { Run } from '../../../shared/types';
import { BoardCard, type FocusedOutput } from './_components/BoardCard';
import { BoardTabs } from './_components/BoardControls';
import { FocusedOutputModal } from './_components/board-page/FocusedOutputModal';
import { useBoardOutputSync } from './_components/board-page/useBoardOutputSync';
import { useBoardViewport } from './_hooks/useBoardViewport';
type Props = {
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
    onSelectSourceNode: (nodeId: string) => void;
    viewportStorageScope: string;
    active: boolean;
    readOnly?: boolean;
};
export function BoardPage({ tabs, activeBoardId, items, run, workflowDirty, onSelectBoard, onCreateBoard, onUpdateItem, onRemoveItem, onDuplicateItem, onSelectSourceNode, viewportStorageScope, active, readOnly = false }: Props) { const [focused, setFocused] = useState<FocusedOutput | null>(null); const resolved = useBoardOutputSync({ items, run, workflowDirty, active, onUpdateItem }); const viewport = useBoardViewport({ activeBoardId, initialViewport: tabs.find((t) => t.id === activeBoardId)?.viewport || { x: 0, y: 0, scale: 1 }, storageScope: viewportStorageScope }); useEffect(() => { if (!active)
    setFocused(null); }, [active]); return <div className="analysis-board" dir="rtl"><BoardTabs tabs={tabs} activeBoardId={activeBoardId} readOnly={readOnly} onSelectBoard={onSelectBoard} onCreateBoard={onCreateBoard}/><div className="analysis-board-canvas" ref={viewport.canvasRef} onPointerDown={viewport.startPan}>{!items.length && <div className="analysis-board-empty workflow-shell-card"><b>این برد هنوز خالی است.</b><span>از پنل خروجی سمت راست، نتیجه‌ها را به این برد اضافه کنید.</span></div>}<div className="analysis-board-world" ref={viewport.worldRef}>{resolved.map(({ item, output, stale }) => <BoardCard key={item.id} item={item} output={output} stale={stale} runId={run?.id} getViewportScale={viewport.getViewportScale} onUpdateItem={onUpdateItem} onRemoveItem={onRemoveItem} onDuplicateItem={onDuplicateItem} onSelectSourceNode={onSelectSourceNode} onFocus={setFocused} readOnly={readOnly} active={active}/>)}</div></div><FocusedOutputModal focused={focused} onClose={() => setFocused(null)}/></div>; }
