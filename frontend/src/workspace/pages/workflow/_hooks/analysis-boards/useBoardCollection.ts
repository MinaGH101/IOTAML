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
        setBoards((current) => current.map((board) => board.id === id ? { ...board, items: updater(board.items) } : board));
    }, []);

    const updateBoardViewport = useCallback((id: string, patch: Partial<BoardViewport>) => {
        if (o.readOnly)
            return;
        setBoards((current) => current.map((board) => {
            if (board.id !== id)
                return board;
            const viewport = normalizeBoardViewport({ ...board.viewport, ...patch }, board.viewport);
            return viewport.x === board.viewport.x && viewport.y === board.viewport.y && viewport.scale === board.viewport.scale
                ? board
                : { ...board, viewport };
        }));
    }, [o.readOnly]);

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
        setBoards((current) => current.map((board) => board.id === id ? { ...board, name: name.trim() } : board));
    }, [o.readOnly]);

    const removeBoard = useCallback((id: string) => {
        if (o.readOnly || id === MAIN_ANALYSIS_BOARD_ID)
            return;
        setBoards((current) => current.filter((board) => board.id !== id));
        setActiveBoardId(MAIN_ANALYSIS_BOARD_ID);
        setTargetBoardId(MAIN_ANALYSIS_BOARD_ID);
    }, [o.readOnly]);

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
    };
}
