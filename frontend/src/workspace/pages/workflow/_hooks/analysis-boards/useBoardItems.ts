import { useCallback } from 'react';
import type { AnalysisBoardItem } from '../../../../_model/board';
import type { Output } from '../../../../_model/output';
import { boardItemsContainOutput, boardOutputKey, boardOutputTitle } from '../../../../_model/boardOutputs';
import { MAIN_ANALYSIS_BOARD_ID } from '../../../../_model/graph';
import type { useBoardCollection } from './useBoardCollection';
import type { AnalysisBoardsOptions } from './types';
export function useBoardItems(o: AnalysisBoardsOptions, c: ReturnType<typeof useBoardCollection>, createReference: (output: Output, nodeId: string | null, key: string) => Pick<AnalysisBoardItem, 'outputRef'>) {
    const addOutputToBoard = useCallback((output: Output, visibleIndex: number, destination: string) => { if (o.readOnly)
        return; const nodeId = output.node_id ? String(output.node_id) : o.selectedNodeId; const nodeOutputs = o.outputs.filter((item) => String(item.node_id || '') === String(nodeId || '')); const found = nodeOutputs.findIndex((item) => item === output); const outputIndex = found >= 0 ? found : visibleIndex; const key = boardOutputKey(output); const exists = c.boards.some((board) => boardItemsContainOutput(board.items, output, nodeId, outputIndex)); if (exists) {
        o.setMessage('we have it already');
        return;
    } const label = o.nodes.find((node) => node.id === nodeId)?.data?.label; c.updateBoardItems(destination, (items) => { const offset = items.length % 5; return [...items, { id: `board-${crypto.randomUUID()}`, nodeId, outputKey: key, outputIndex, outputTitle: boardOutputTitle(output, outputIndex), outputKind: String(output.kind || 'json'), sourceLabel: label ? String(label) : undefined, x: 28 + offset * 34, y: 28 + offset * 34, w: 440, h: 330, runId: o.currentRunId, ...createReference(output, nodeId, key), createdAt: new Date().toISOString() }]; }); c.setActiveBoardId(destination); c.setTargetBoardId(destination); o.setBoardOpen(true); o.setMessage(`خروجی به ${c.boards.find((b) => b.id === destination)?.name || 'برد اصلی'} اضافه شد`); }, [c.boards, c.setActiveBoardId, c.setTargetBoardId, c.updateBoardItems, createReference, o.currentRunId, o.nodes, o.outputs, o.readOnly, o.selectedNodeId, o.setBoardOpen, o.setMessage]);
    const addOutputToMainBoard = useCallback((output: Output, index: number) => addOutputToBoard(output, index, MAIN_ANALYSIS_BOARD_ID), [addOutputToBoard]);
    const addOutputFromResults = useCallback((output: Output, index: number) => addOutputToBoard(output, index, o.boardOpen ? c.targetBoardId : MAIN_ANALYSIS_BOARD_ID), [addOutputToBoard, c.targetBoardId, o.boardOpen]);
    const renameNodeSources = useCallback((id: string, label: string) => { if (!o.readOnly)
        c.setBoards((current) => current.map((b) => ({ ...b, items: b.items.map((item) => item.nodeId === id ? { ...item, sourceLabel: label } : item) }))); }, [c.setBoards, o.readOnly]);
    const updateItem = useCallback((id: string, patch: Partial<AnalysisBoardItem>) => { if (!o.readOnly)
        c.updateBoardItems(c.activeBoardId, (items) => items.map((item) => item.id === id ? { ...item, ...patch } : item)); }, [c.activeBoardId, c.updateBoardItems, o.readOnly]);
    const removeItem = useCallback((id: string) => { if (!o.readOnly)
        c.updateBoardItems(c.activeBoardId, (items) => items.filter((item) => item.id !== id)); }, [c.activeBoardId, c.updateBoardItems, o.readOnly]);
    const duplicateItem = useCallback((_item: AnalysisBoardItem) => { if (!o.readOnly)
        o.setMessage('we have it already'); }, [o.readOnly, o.setMessage]);
    return { addOutputToMainBoard, addOutputFromResults, renameNodeSources, updateItem, removeItem, duplicateItem };
}
