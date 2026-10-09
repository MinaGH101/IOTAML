import { Check, LockKeyhole, LockKeyholeOpen, Pencil, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeAnalysisBoardZoom, type AnalysisBoardItem, type AnalysisBoardTab, type BoardViewport } from '../../_model/board';
import type { Output } from '../../_model/output';
import { clearBoardOutputDrag, getBoardOutputDrag } from '../../_model/boardOutputDrag';
import type { Run } from '../../../shared/types';
import { ConfirmDialog } from '../../../shared/ui';
import { BoardCard, type FocusedOutput } from './_components/BoardCard';
import { BoardTabs } from './_components/BoardControls';
import { BoardScrollbar } from './_components/BoardScrollbar';
import { ZoomControls } from './_components/ZoomControls';
import { FocusedOutputModal } from './_components/board-page/FocusedOutputModal';
import { useBoardOutputSync } from './_components/board-page/useBoardOutputSync';
import { useBoardCardInteractions } from './_hooks/useBoardCardInteractions';
import type { BoardCaseFilters } from './_hooks/useBoardCaseFilters';
import { useBoardScrollPersistence } from './_hooks/useBoardScrollPersistence';
import { BOARD_BASE_WIDTH, arrangeBoardRows, boardDisplayWidth, boardLayoutWidth, boardOuterWidthLimit, boardUnitWidth, clampBoardHeight, clampBoardWidth, resizeBoardPair, type BoardItemPlacement } from './_utils/boardGrid';
import { reviewBatchStage } from './_utils/reviewBatchOutput';

type Props = {
    caseExtractNodeIds: string[];
    tabs: AnalysisBoardTab[];
    activeBoardId: string;
    items: AnalysisBoardItem[];
    run: Run | null;
    workflowDirty: boolean;
    onSelectBoard: (id: string) => void;
    onCreateBoard: () => void;
    onRenameBoard: (id: string, name: string) => void;
    onRemoveBoard: (id: string) => void;
    onUpdateItem: (id: string, patch: Partial<AnalysisBoardItem>) => void;
    onRemoveItem: (id: string) => void;
    onMoveItem: (sourceId: string, target: BoardItemPlacement) => void;
    onAddOutputAt: (output: Output, index: number, target?: BoardItemPlacement | null) => void;
    onUpdateViewport: (id: string, patch: Partial<BoardViewport>) => void;
    onOpenOutputs: () => void;
    onSave: () => Promise<unknown>;
    active: boolean;
    nodesOpen: boolean;
    onToggleNodes: () => void;
    readOnly?: boolean;
    canManageLocks?: boolean;
    onToggleBoardLock?: (id: string) => void;
    caseFilters: BoardCaseFilters;
};

const objectValue = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function BoardPage({ caseExtractNodeIds, tabs, activeBoardId, items, run, workflowDirty, onSelectBoard, onCreateBoard, onRenameBoard, onRemoveBoard, onUpdateItem, onRemoveItem, onMoveItem, onAddOutputAt, onUpdateViewport, onOpenOutputs, onSave, active, nodesOpen, onToggleNodes, readOnly = false, canManageLocks = false, onToggleBoardLock, caseFilters }: Props) {
    const [focused, setFocused] = useState<FocusedOutput | null>(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [columns, setColumns] = useState(4);
    const [availableWidth, setAvailableWidth] = useState(1280);
    const activeTab = tabs.find((tab) => tab.id === activeBoardId);
    const boardLocked = activeTab?.locked === true;
    const boardReadOnly = readOnly || (boardLocked && !canManageLocks);
    const viewport = activeTab?.viewport || { x: 0, y: 0, scale: 1 };
    const boardZoom = viewport.scale;
    const layoutWidth = boardLayoutWidth(availableWidth, boardZoom);
    const unitWidth = boardUnitWidth(layoutWidth, columns);
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const gridRef = useRef<HTMLDivElement | null>(null);
    const knownIds = useRef(new Set(tabs.flatMap((tab) => tab.items.map((item) => item.id))));
    const resolved = useBoardOutputSync({ items, run, workflowDirty, active, onUpdateItem });
    const extractIds = useMemo(() => new Set(caseExtractNodeIds), [caseExtractNodeIds]);
    const byId = useMemo(() => new Map(resolved.map((value) => {
        const hasActiveCaseFilters = caseFilters.selectedCaseId !== null || Boolean(caseFilters.caseSearch) || Boolean(caseFilters.caseStatus) || Boolean(caseFilters.caseMinScore);
        if (value.item.outputKind === 'work_task_result') {
            if (!hasActiveCaseFilters) return [value.item.id, value] as const;
            const allowedCaseIds = new Set(caseFilters.filteredCases.map((item) => item.case_id));
            const responses = Array.isArray(value.output.responses)
                ? value.output.responses.filter((response): response is Record<string, unknown> => Boolean(response) && typeof response === 'object' && !Array.isArray(response))
                : [];
            const filteredResponses = responses.filter((response) => allowedCaseIds.has(String(response.subject_id || value.output.subject_id || '')));
            const output: Output = {
                ...value.output,
                responses: filteredResponses,
                subject_ids: filteredResponses.map((response) => String(response.subject_id || '')).filter(Boolean),
                assigned: filteredResponses.length,
                completed: filteredResponses.filter((response) => response.status === 'completed').length,
            };
            return [value.item.id, { ...value, output, stale: false }] as const;
        }
        if (!value.item.nodeId || !['review_form', 'review_stage', 'review_score', 'review_batch'].includes(value.item.outputKind)) return [value.item.id, value] as const;
        const caseValues = caseFilters.filteredCases.reduce<Record<string, unknown>[]>((collected, item) => {
            const results = objectValue(item.results);
            const stages = objectValue(results.stages);
            const saved = objectValue(stages[String(value.item.nodeId)]);
            if (Object.keys(saved).length) collected.push({ ...saved, case_id: saved.case_id || item.case_id });
            else if (extractIds.has(String(value.item.nodeId))) {
                const fields = objectValue(results.fields);
                collected.push({ schema_version: 1, case_id: item.case_id, status: item.status, stage: 'RV-003',
                    fields: Object.keys(fields).length ? fields : objectValue(item.fields), field_labels: objectValue(results.field_labels),
                    documents: Array.isArray(results.documents) ? results.documents : [] });
            }
            return collected;
        }, []);
        const output: Output = { kind: 'review_batch', title: value.item.outputTitle, node_id: value.item.nodeId,
            stage: reviewBatchStage(caseValues, value.output),
            case_count: caseValues.length, cases: caseValues };
        return [value.item.id, { ...value, output, stale: false }] as const;
    })), [caseFilters.filteredCases, extractIds, resolved]);
    const interaction = useBoardCardInteractions({ items, columns, unitWidth, layoutWidth, movable: editing && !boardReadOnly, resizable: editing && !boardReadOnly, boardZoom, canvasRef, gridRef, onMoveItem, onUpdateItem });
    const layoutItems = useMemo(() => items.map((item) => {
        const preview = interaction.resizePreview;
        if (item.id === preview?.id) return { ...item, w: preview.w, h: preview.h };
        if (item.id === preview?.neighborId && preview.neighborW !== undefined) return { ...item, w: preview.neighborW };
        return item;
    }), [items, interaction.resizePreview]);
    const rows = useMemo(() => arrangeBoardRows(layoutItems, layoutWidth, columns, unitWidth), [columns, layoutItems, layoutWidth, unitWidth]);
    const contentKey = `${activeBoardId}:${items.length ? 'grid' : 'empty'}`;
    const { onScroll } = useBoardScrollPersistence({ activeBoardId, viewport, canvasRef, contentKey, onUpdateViewport });
    const setBoardZoom = useCallback((value: number) => onUpdateViewport(activeBoardId, { scale: normalizeAnalysisBoardZoom(value) }), [activeBoardId, onUpdateViewport]);
    const setCardZoom = useCallback((id: string, value: number) => onUpdateItem(id, { contentZoom: normalizeAnalysisBoardZoom(value) }), [onUpdateItem]);

    useEffect(() => { if (!active) setFocused(null); }, [active]);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const update = () => {
            const style = getComputedStyle(canvas);
            const width = canvas.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
            setAvailableWidth(Math.max(1, width));
            setColumns(width >= 1040 ? 4 : width >= 620 ? 2 : 1);
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(canvas);
        return () => observer.disconnect();
    }, []);
    useEffect(() => { if (boardReadOnly) setEditing(false); }, [boardReadOnly]);
    useEffect(() => {
        if (active && !boardReadOnly && items.some((item) => !knownIds.current.has(item.id))) setEditing(true);
        for (const tab of tabs) for (const item of tab.items) knownIds.current.add(item.id);
    }, [active, boardReadOnly, items, tabs]);

    const save = async () => {
        if (saving) return;
        setSaving(true);
        setSaveError('');
        try { await onSave(); setEditing(false); }
        catch { setSaveError('ذخیره داشبورد انجام نشد. دوباره تلاش کنید.'); }
        finally { setSaving(false); }
    };
    const moveByKeyboard = useCallback((id: string, direction: -1 | 1) => {
        const index = items.findIndex((item) => item.id === id);
        const target = items[index + direction];
        if (target) onMoveItem(id, { targetId: target.id, after: direction === 1 });
    }, [items, onMoveItem]);
    const resizeByKeyboard = useCallback((id: string, key: string, side: 'left' | 'right') => {
        if (!editing || boardReadOnly) return;
        const item = items.find((entry) => entry.id === id);
        if (!item) return;
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            const grow = side === 'left' ? key === 'ArrowLeft' : key === 'ArrowRight';
            const requested = item.w + (grow ? 10 : -10);
            const row = arrangeBoardRows(items, layoutWidth, columns, unitWidth).find((entry) => entry.items.some((member) => member.id === id));
            const index = row?.items.findIndex((member) => member.id === id) ?? -1;
            const neighbor = row?.items[index + (side === 'left' ? 1 : -1)];
            if (neighbor) {
                const maxWidth = boardZoom < 1 ? Math.floor(layoutWidth * BOARD_BASE_WIDTH / unitWidth) : undefined;
                const pair = resizeBoardPair(item.w, neighbor.w, requested, unitWidth, columns, maxWidth);
                if (pair.width !== item.w) onUpdateItem(id, { w: pair.width });
                if (pair.neighborWidth !== neighbor.w) onUpdateItem(neighbor.id, { w: pair.neighborWidth });
            } else {
                const width = clampBoardWidth(requested, unitWidth, columns, boardOuterWidthLimit(row, id, layoutWidth, unitWidth));
                if (width !== item.w) onUpdateItem(id, { w: width });
            }
        } else onUpdateItem(id, { h: clampBoardHeight(item.h + (key === 'ArrowDown' ? 10 : -10)) });
    }, [boardReadOnly, boardZoom, columns, editing, items, layoutWidth, onUpdateItem, unitWidth]);

    return <div className={`analysis-board ${editing ? 'is-editing' : ''} ${boardLocked ? 'is-owner-locked' : ''} ${boardZoom < 1 ? 'is-zoomed-out' : ''} ${editing && !boardReadOnly ? 'is-resizable' : ''} ${interaction.draggingId ? 'is-dragging' : ''}`} dir="rtl">
      <div className="analysis-board-chrome">
        <div className="analysis-board-heading">
          <div className="analysis-board-title"><h2>{activeTab?.name || 'برد تحلیل'}</h2>{boardLocked && <span className="analysis-board-lock-badge"><LockKeyhole size={13}/>قفل مالک</span>}</div>
          {canManageLocks && activeTab && <button className={`analysis-board-lock-button ${boardLocked ? 'is-locked' : ''}`} type="button" title={boardLocked ? 'باز کردن قفل برد' : 'قفل کردن برد برای اعضای تیم'} aria-label={boardLocked ? 'باز کردن قفل برد' : 'قفل کردن برد'} onClick={() => onToggleBoardLock?.(activeTab.id)}>{boardLocked ? <LockKeyhole size={16}/> : <LockKeyholeOpen size={16}/>}</button>}
          {!boardReadOnly && <button className={`analysis-board-edit-button ${editing ? 'primary' : ''}`} type="button" disabled={saving} title={editing ? 'ذخیره و پایان ویرایش' : 'ویرایش'} aria-label={editing ? (saving ? 'در حال ذخیره' : 'ذخیره و پایان ویرایش') : 'ویرایش'} onClick={editing ? () => { void save(); } : () => setEditing(true)}>{editing ? <Check size={16}/> : <Pencil size={16}/>}</button>}
          <ZoomControls value={boardZoom} onChange={setBoardZoom} label="بزرگ‌نمایی کل برد" disabled={boardReadOnly}/>
        </div>
        <BoardTabs tabs={tabs} activeBoardId={activeBoardId} editing={editing} readOnly={boardReadOnly} nodesOpen={nodesOpen} onToggleNodes={onToggleNodes} onSelectBoard={onSelectBoard} onCreateBoard={() => { setEditing(true); onCreateBoard(); }} onRenameBoard={onRenameBoard} onRemoveBoard={setPendingDeleteId}/>
      </div>
      {boardLocked && !canManageLocks && <div className="analysis-board-locked-note"><LockKeyhole size={15}/><span>این برد توسط مالک پروژه قفل شده و فقط قابل مشاهده است.</span></div>}
      {saveError && <div className="analysis-board-save-error" role="alert">{saveError}</div>}
      <div className="analysis-board-body" onDragOver={(event) => {
          if (boardReadOnly || !editing || !getBoardOutputDrag()) return;
          event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy';
          interaction.setDropTarget(interaction.targetAt(event.clientX, event.clientY));
      }} onDragLeave={(event) => { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) interaction.setDropTarget(null); }} onDrop={(event) => {
          const dragged = getBoardOutputDrag();
          if (!dragged || boardReadOnly || !editing) return;
          event.preventDefault(); event.stopPropagation();
          const target = interaction.targetAt(event.clientX, event.clientY);
          onAddOutputAt(dragged.output, dragged.index, target);
          interaction.setDropTarget(null); clearBoardOutputDrag();
      }}><div className="analysis-board-canvas" ref={canvasRef} onScroll={onScroll}>
        {items.length === 0 ? <div className="analysis-board-empty workflow-shell-card"><Plus size={24}/><b>این برد هنوز خالی است</b><span>از پنل خروجی سمت راست، نمودار یا جدول را به برد اضافه کنید.</span>{editing && <button type="button" className="analysis-board-open-outputs" onClick={onOpenOutputs}>نمایش خروجی‌ها</button>}</div> : <div className="analysis-board-grid" ref={gridRef} style={{ zoom: boardZoom, width: layoutWidth }}>
          {rows.map((row) => {
              const rowTarget = interaction.dropTarget?.newRow && row.items.some((item) => item.id === interaction.dropTarget?.targetId)
                  ? (interaction.dropTarget.after ? 'drop-row-after' : 'drop-row-before')
                  : '';
              return <div className={`analysis-board-row ${rowTarget}`} key={row.items.map((item) => item.id).join(':')} style={{ minHeight: row.height }}>
                {row.items.map((item) => {
                    const entry = byId.get(item.id);
                    const target = interaction.dropTarget?.targetId === item.id ? interaction.dropTarget : null;
                    const dropSide = target && !target.newRow ? (target.after ? 'drop-after' : 'drop-before') : '';
                    return <div key={item.id} data-board-item-id={item.id} className={`analysis-board-grid-cell ${dropSide}`} style={{ width: boardDisplayWidth(item.w, unitWidth, layoutWidth), height: item.h }}>
                      <BoardCard item={item} output={entry?.output} stale={entry?.stale ?? false} runId={run?.id} editing={editing} movable={editing && !boardReadOnly} resizable={editing && !boardReadOnly} active={active} dragging={interaction.draggingId === item.id} resizing={interaction.resizePreview?.id === item.id || interaction.resizePreview?.neighborId === item.id} zoom={item.contentZoom ?? 1} onZoomChange={setCardZoom} onRemoveItem={onRemoveItem} onFocus={setFocused} onStartMove={interaction.startMove} onStartResize={interaction.startResize} onMoveKey={moveByKeyboard} onResizeKey={resizeByKeyboard}/>
                    </div>;
                })}
              </div>;
          })}
          {editing && <button className="analysis-board-add-slot" type="button" onClick={onOpenOutputs}><Plus size={20}/><span>افزودن نمودار یا جدول</span></button>}
        </div>}
      </div><BoardScrollbar canvasRef={canvasRef} contentKey={contentKey}/></div>
      <FocusedOutputModal focused={focused} onClose={() => setFocused(null)}/>
      <ConfirmDialog open={Boolean(pendingDeleteId)} title="حذف برد" message={`برد «${tabs.find((tab) => tab.id === pendingDeleteId)?.name || ''}» و چیدمان آن حذف شود؟ خروجی‌های اصلی حفظ می‌شوند.`} confirmLabel="حذف برد" danger onClose={() => setPendingDeleteId(null)} onConfirm={() => { if (pendingDeleteId) onRemoveBoard(pendingDeleteId); setPendingDeleteId(null); }}/>
    </div>;
}
