import { useCallback, useMemo, useState } from 'react';
import type { Node } from '@xyflow/react';
import type { AnalysisBoardItem, AnalysisBoardTab, BoardViewport } from '../../../_model/board';
import type { Output } from '../../../_model/output';
import {
  boardOutputTitle,
} from '../../../_model/graph';
import {
  createMainAnalysisBoard,
  MAIN_ANALYSIS_BOARD_ID,
  serializeAnalysisBoardTabs,
} from '../../../_model/graph';

type UseAnalysisBoardsOptions = {
  outputs: Output[];
  currentRunId: number | null;
  nodes: Node[];
  selectedNodeId: string | null;
  readOnly: boolean;
  boardOpen: boolean;
  setBoardOpen: (open: boolean) => void;
  setMessage: (message: string) => void;
};

export function useAnalysisBoards({
  outputs,
  currentRunId,
  nodes,
  selectedNodeId,
  readOnly,
  boardOpen,
  setBoardOpen,
  setMessage,
}: UseAnalysisBoardsOptions) {
  const [boards, setBoards] = useState<AnalysisBoardTab[]>(() => [createMainAnalysisBoard()]);
  const [activeBoardId, setActiveBoardId] = useState(MAIN_ANALYSIS_BOARD_ID);
  const [targetBoardId, setTargetBoardId] = useState(MAIN_ANALYSIS_BOARD_ID);

  const activeBoard = useMemo(
    () => boards.find((board) => board.id === activeBoardId) || boards[0],
    [activeBoardId, boards],
  );

  const updateBoardItems = useCallback((
    boardId: string,
    updater: (items: AnalysisBoardItem[]) => AnalysisBoardItem[],
  ) => {
    setBoards((current) => current.map((board) => (
      board.id === boardId ? { ...board, items: updater(board.items) } : board
    )));
  }, []);

  const restoreBoards = useCallback((nextBoards: AnalysisBoardTab[], requestedId: string) => {
    const nextActiveId = nextBoards.some((board) => board.id === requestedId)
      ? requestedId
      : MAIN_ANALYSIS_BOARD_ID;
    setBoards(nextBoards);
    setActiveBoardId(nextActiveId);
    setTargetBoardId(nextActiveId);
  }, []);

  const selectBoard = useCallback((id: string) => {
    setActiveBoardId(id);
    setTargetBoardId(id);
  }, []);

  const addOutputToBoard = useCallback((
    output: Output,
    visibleIndex: number,
    destinationBoardId: string,
  ) => {
    if (readOnly) return;
    const nodeId = output.node_id ? String(output.node_id) : selectedNodeId;
    const nodeOutputs = outputs.filter(
      (item) => String(item.node_id || '') === String(nodeId || ''),
    );
    const nodeOutputIndex = nodeOutputs.findIndex((item) => item === output);
    const outputIndex = nodeOutputIndex >= 0 ? nodeOutputIndex : visibleIndex;
    const nodeLabel = nodes.find((node) => node.id === nodeId)?.data?.label;

    updateBoardItems(destinationBoardId, (items) => {
      const offset = items.length % 5;
      return [...items, {
        id: `board-${crypto.randomUUID()}`,
        nodeId,
        outputIndex,
        outputTitle: boardOutputTitle(output, outputIndex),
        outputKind: String(output.kind || 'json'),
        sourceLabel: nodeLabel ? String(nodeLabel) : undefined,
        x: 28 + offset * 34,
        y: 28 + offset * 34,
        w: 440,
        h: 330,
        runId: currentRunId,
        snapshot: output,
        createdAt: new Date().toISOString(),
      }];
    });
    setActiveBoardId(destinationBoardId);
    setTargetBoardId(destinationBoardId);
    setBoardOpen(true);
    const destination = boards.find((board) => board.id === destinationBoardId)?.name || 'برد اصلی';
    setMessage(`خروجی به ${destination} اضافه شد`);
  }, [boards, currentRunId, nodes, outputs, readOnly, selectedNodeId, setBoardOpen, setMessage, updateBoardItems]);

  const addOutputToMainBoard = useCallback((output: Output, visibleIndex: number) => {
    addOutputToBoard(output, visibleIndex, MAIN_ANALYSIS_BOARD_ID);
  }, [addOutputToBoard]);

  const addOutputFromResults = useCallback((output: Output, visibleIndex: number) => {
    addOutputToBoard(
      output,
      visibleIndex,
      boardOpen ? targetBoardId : MAIN_ANALYSIS_BOARD_ID,
    );
  }, [addOutputToBoard, boardOpen, targetBoardId]);

  const createBoard = useCallback(() => {
    if (readOnly) return;
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
  }, [readOnly]);

  const updateViewport = useCallback((boardId: string, viewport: BoardViewport) => {
    if (readOnly) return;
    setBoards((current) => current.map((board) => {
      if (board.id !== boardId) return board;
      const previous = board.viewport || { x: 0, y: 0, scale: 1 };
      if (
        Math.abs(previous.x - viewport.x) < 0.01
        && Math.abs(previous.y - viewport.y) < 0.01
        && Math.abs(previous.scale - viewport.scale) < 0.0001
      ) return board;
      return { ...board, viewport };
    }));
  }, [readOnly]);

  const renameBoard = useCallback((id: string, name: string) => {
    if (readOnly || !name.trim()) return;
    setBoards((current) => current.map((board) => (
      board.id === id ? { ...board, name: name.trim() } : board
    )));
  }, [readOnly]);

  const removeBoard = useCallback((id: string) => {
    if (readOnly || id === MAIN_ANALYSIS_BOARD_ID) return;
    setBoards((current) => current.filter((board) => board.id !== id));
    setActiveBoardId(MAIN_ANALYSIS_BOARD_ID);
    setTargetBoardId(MAIN_ANALYSIS_BOARD_ID);
  }, [readOnly]);

  const renameNodeSources = useCallback((nodeId: string, label: string) => {
    if (readOnly) return;
    setBoards((current) => current.map((board) => ({
      ...board,
      items: board.items.map((item) => (
        item.nodeId === nodeId ? { ...item, sourceLabel: label } : item
      )),
    })));
  }, [readOnly]);

  const updateItem = useCallback((id: string, patch: Partial<AnalysisBoardItem>) => {
    if (readOnly) return;
    updateBoardItems(activeBoardId, (items) => items.map((item) => (
      item.id === id ? { ...item, ...patch } : item
    )));
  }, [activeBoardId, readOnly, updateBoardItems]);

  const removeItem = useCallback((id: string) => {
    if (readOnly) return;
    updateBoardItems(activeBoardId, (items) => items.filter((item) => item.id !== id));
  }, [activeBoardId, readOnly, updateBoardItems]);

  const duplicateItem = useCallback((item: AnalysisBoardItem) => {
    if (readOnly) return;
    updateBoardItems(activeBoardId, (items) => [...items, {
      ...item,
      id: `board-${crypto.randomUUID()}`,
      x: item.x + 26,
      y: item.y + 26,
      createdAt: new Date().toISOString(),
    }]);
  }, [activeBoardId, readOnly, updateBoardItems]);

  const serializedBoards = useMemo(() => serializeAnalysisBoardTabs(boards), [boards]);
  const persistenceSignature = useMemo(() => boards.map((board) => ({
    id: board.id,
    name: board.name,
    viewport: board.viewport,
    createdAt: board.createdAt,
    items: board.items.map((item) => ({
      id: item.id,
      nodeId: item.nodeId,
      outputIndex: item.outputIndex,
      outputTitle: item.outputTitle,
      outputKind: item.outputKind,
      sourceLabel: item.sourceLabel,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      runId: item.runId,
      createdAt: item.createdAt,
      snapshotKind: item.snapshot?.kind,
      snapshotTitle: item.snapshot?.title,
    })),
  })), [boards]);

  return {
    boards,
    activeBoard,
    activeBoardId,
    targetBoardId,
    restoreBoards,
    selectBoard,
    addOutputToMainBoard,
    addOutputFromResults,
    createBoard,
    updateViewport,
    renameBoard,
    removeBoard,
    renameNodeSources,
    updateItem,
    removeItem,
    duplicateItem,
    serializedBoards,
    persistenceSignature,
  };
}
