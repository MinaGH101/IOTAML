import { useCallback, useMemo, useState } from 'react';
import { normalizeBoardViewport, type AnalysisBoardItem, type AnalysisBoardTab, type BoardViewport } from '../../../../_model/board';
import { createMainAnalysisBoard, MAIN_ANALYSIS_BOARD_ID } from '../../../../_model/graph';
import type { AnalysisBoardsOptions } from './types';

export function useBoardCollection(o: AnalysisBoardsOptions) {
    const [boards, setBoards] = useState<AnalysisBoardTab[]>(() => [createMainAnalysisBoard()]);
    const [activeBoardId, setActiveBoardId] = useState(MAIN_ANALYSIS_BOARD_ID);
    const [targetBoardId, setTargetBoardId] = useState(MAIN_ANALYSIS_BOARD_ID);
    const activeBoard = useMemo(() => boards.find((board) => board.id === activeBoardId) || boards[0], [activeBoardId, boards]);

    const updateBoardItems = useCallback((id: string, updater: (items: AnalysisBoardItem[]) => AnalysisBoardItem[]) => {
        if (o.readOnly)
            return;
        setBoards((current) => current.map((board) => board.id === id && (!board.locked || o.canManageLocks)
            ? { ...board, items: updater(board.items) }
            : board));
    }, [o.canManageLocks, o.readOnly]);

    const updateBoardViewport = useCallback((id: string, patch: Partial<BoardViewport>) => {
        if (o.readOnly)
            return;
        setBoards((current) => current.map((board) => {
            if (board.id !== id || (board.locked && !o.canManageLocks))
                return board;
            const viewport = normalizeBoardViewport({ ...board.viewport, ...patch }, board.viewport);
            return viewport.x === board.viewport.x && viewport.y === board.viewport.y && viewport.scale === board.viewport.scale
                ? board
                : { ...board, viewport };
        }));
    }, [o.canManageLocks, o.readOnly]);

    const restoreBoards = useCallback((next: AnalysisBoardTab[], requested: string) => {
        const id = next.some((board) => board.id === requested) ? requested : MAIN_ANALYSIS_BOARD_ID;
        setBoards(next);
        setActiveBoardId(id);
        setTargetBoardId(id);
    }, []);

    const selectBoard = useCallback((id: string) => {
        setActiveBoardId(id);
        setTargetBoardId(id);
    }, []);

    const createBoard = useCallback(() => {
        if (o.readOnly)
            return;
        const id = `analysis-board-${crypto.randomUUID()}`;
        setBoards((current) => [...current, {
            id,
            name: `برد ${current.length + 1}`,
            locked: false,
            items: [],
            viewport: { x: 0, y: 0, scale: 1 },
            createdAt: new Date().toISOString(),
        }]);
        setActiveBoardId(id);
        setTargetBoardId(id);
    }, [o.readOnly]);

    const renameBoard = useCallback((id: string, name: string) => {
        if (o.readOnly || !name.trim())
            return;
        setBoards((current) => current.map((board) => board.id === id && (!board.locked || o.canManageLocks) ? { ...board, name: name.trim() } : board));
    }, [o.canManageLocks, o.readOnly]);

    const removeBoard = useCallback((id: string) => {
        if (o.readOnly || id === MAIN_ANALYSIS_BOARD_ID)
            return;
        setBoards((current) => current.filter((board) => board.id !== id || (board.locked && !o.canManageLocks)));
        setActiveBoardId(MAIN_ANALYSIS_BOARD_ID);
        setTargetBoardId(MAIN_ANALYSIS_BOARD_ID);
    }, [o.canManageLocks, o.readOnly]);

    const toggleBoardLock = useCallback((id: string) => {
        if (o.readOnly || !o.canManageLocks)
            return;
        setBoards((current) => current.map((board) => board.id === id ? { ...board, locked: !board.locked } : board));
    }, [o.canManageLocks, o.readOnly]);

    return {
        boards,
        setBoards,
        activeBoard,
        activeBoardId,
        targetBoardId,
        setActiveBoardId,
        setTargetBoardId,
        updateBoardItems,
        updateBoardViewport,
        restoreBoards,
        selectBoard,
        createBoard,
        renameBoard,
        removeBoard,
        toggleBoardLock,
    };
}
