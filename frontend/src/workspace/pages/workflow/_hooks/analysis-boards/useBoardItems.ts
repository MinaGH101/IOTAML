import { useCallback, useEffect, useMemo } from 'react';
import type { AnalysisBoardItem } from '../../../../_model/board';
import { boardSourceIdentity } from '../../../../_model/boardIdentity';
import type { Output } from '../../../../_model/output';
import { boardItemsContainOutput, boardOutputKey, boardOutputTitle } from '../../../../_model/boardOutputs';
import { MAIN_ANALYSIS_BOARD_ID } from '../../../../_model/graph';
import { insertBoardItem, moveBoardItem, type BoardItemPlacement } from '../../../board/_utils/boardGrid';
import type { useBoardCollection } from './useBoardCollection';
import type { AnalysisBoardsOptions } from './types';
export function useBoardItems(o: AnalysisBoardsOptions, c: ReturnType<typeof useBoardCollection>, createReference: (output: Output, nodeId: string | null, key: string) => Pick<AnalysisBoardItem, 'outputRef'>) {
    const sourceByNodeId = useMemo(() => new Map(o.nodes.map((node) => [node.id, boardSourceIdentity(node, o.registry, o.aliases)])), [o.aliases, o.nodes, o.registry]);
    useEffect(() => {
        if (!sourceByNodeId.size)
            return;
        c.setBoards((current) => {
            let changed = false;
            const next = current.map((board) => {
                if (board.locked && !o.canManageLocks)
                    return board;
                let boardChanged = false;
                const items = board.items.map((item) => {
                    const source = item.nodeId ? sourceByNodeId.get(item.nodeId) : undefined;
                    const needsReviewSize = ['review_score', 'review_stage', 'review_batch'].includes(item.outputKind) && item.w === 440 && item.h === 330;
                    if (!source && !needsReviewSize)
                        return item;
                    const sourceLabel = source?.sourceLabel || item.sourceLabel;
                    const sourceTypeLabel = source?.sourceTypeLabel || item.sourceTypeLabel;
                    if (!needsReviewSize && sourceLabel === item.sourceLabel && sourceTypeLabel === item.sourceTypeLabel)
                        return item;
                    changed = true;
                    boardChanged = true;
                    return { ...item, sourceLabel, sourceTypeLabel, ...(needsReviewSize ? { w: 500, h: 500 } : {}) };
                });
                return boardChanged ? { ...board, items } : board;
            });
            return changed ? next : current;
        });
    }, [c.boards, c.setBoards, o.canManageLocks, sourceByNodeId]);
    const addOutputToBoard = useCallback((output: Output, visibleIndex: number, destination: string, target?: BoardItemPlacement | null) => { if (o.readOnly)
        return; const destinationBoard = c.boards.find((board) => board.id === destination); if (destinationBoard?.locked && !o.canManageLocks) {
        o.setMessage('برد مقصد توسط مالک پروژه قفل شده است.');
        return;
    } const nodeId = output.node_id ? String(output.node_id) : o.selectedNodeId; const nodeOutputs = o.outputs.filter((item) => String(item.node_id || '') === String(nodeId || '')); const found = nodeOutputs.findIndex((item) => item === output); const outputIndex = found >= 0 ? found : visibleIndex; const key = boardOutputKey(output); const exists = c.boards.some((board) => boardItemsContainOutput(board.items, output, nodeId, outputIndex)); if (exists) {
        o.setMessage('we have it already');
        return;
    } const source = sourceByNodeId.get(String(nodeId || '')); c.updateBoardItems(destination, (items) => { const offset = items.length % 5; const reviewCard = ['review_score', 'review_stage', 'review_batch'].includes(String(output.kind || '')); const item: AnalysisBoardItem = { id: `board-${crypto.randomUUID()}`, nodeId, outputKey: key, outputIndex, outputTitle: boardOutputTitle(output, outputIndex), outputKind: String(output.kind || 'json'), ...source, x: 28 + offset * 34, y: 28 + offset * 34, w: reviewCard ? 500 : 440, h: reviewCard ? 500 : 330, runId: o.currentRunId, ...createReference(output, nodeId, key), createdAt: new Date().toISOString() }; return insertBoardItem(items, item, target); }); c.setActiveBoardId(destination); c.setTargetBoardId(destination); o.setBoardOpen(true); o.setMessage(`خروجی به ${destinationBoard?.name || 'برد اصلی'} اضافه شد`); }, [c.boards, c.setActiveBoardId, c.setTargetBoardId, c.updateBoardItems, createReference, o.canManageLocks, o.currentRunId, o.outputs, o.readOnly, o.selectedNodeId, o.setBoardOpen, o.setMessage, sourceByNodeId]);
    const addOutputToMainBoard = useCallback((output: Output, index: number) => addOutputToBoard(output, index, MAIN_ANALYSIS_BOARD_ID), [addOutputToBoard]);
    const addOutputFromResults = useCallback((output: Output, index: number) => addOutputToBoard(output, index, o.boardOpen ? c.targetBoardId : MAIN_ANALYSIS_BOARD_ID), [addOutputToBoard, c.targetBoardId, o.boardOpen]);
    const addOutputAt = useCallback((output: Output, index: number, target?: BoardItemPlacement | null) => addOutputToBoard(output, index, c.activeBoardId, target || undefined), [addOutputToBoard, c.activeBoardId]);
    const renameNodeSources = useCallback((id: string, label: string) => { if (!o.readOnly)
        c.setBoards((current) => current.map((b) => b.locked && !o.canManageLocks ? b : ({ ...b, items: b.items.map((item) => item.nodeId === id ? { ...item, sourceLabel: label } : item) }))); }, [c.setBoards, o.canManageLocks, o.readOnly]);
    const updateItem = useCallback((id: string, patch: Partial<AnalysisBoardItem>) => { if (!o.readOnly)
        c.updateBoardItems(c.activeBoardId, (items) => items.map((item) => item.id === id ? { ...item, ...patch } : item)); }, [c.activeBoardId, c.updateBoardItems, o.readOnly]);
    const removeItem = useCallback((id: string) => { if (!o.readOnly)
        c.updateBoardItems(c.activeBoardId, (items) => items.filter((item) => item.id !== id)); }, [c.activeBoardId, c.updateBoardItems, o.readOnly]);
    const moveItem = useCallback((sourceId: string, target: BoardItemPlacement) => { if (!o.readOnly)
        c.updateBoardItems(c.activeBoardId, (items) => moveBoardItem(items, sourceId, target)); }, [c.activeBoardId, c.updateBoardItems, o.readOnly]);
    const duplicateItem = useCallback((_item: AnalysisBoardItem) => { if (!o.readOnly)
        o.setMessage('we have it already'); }, [o.readOnly, o.setMessage]);
    return { addOutputToMainBoard, addOutputFromResults, addOutputAt, renameNodeSources, updateItem, removeItem, moveItem, duplicateItem };
}
