import { useCallback, useState } from 'react';
import type { AnalysisBoardTab } from '../../../../../_model/board';
import { MAIN_ANALYSIS_BOARD_ID } from '../../../../../_model/graph';

export function useBoardDialogs({
  activeBoard,
  readOnly,
  renameBoard,
  removeBoard,
}: {
  activeBoard: AnalysisBoardTab | undefined;
  readOnly: boolean;
  renameBoard: (id: string, name: string) => void;
  removeBoard: (id: string) => void;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openRename = useCallback(() => {
    if (!activeBoard || readOnly) return;
    setRenameDraft(activeBoard.name);
    setRenameOpen(true);
  }, [activeBoard, readOnly]);

  const confirmRename = useCallback(() => {
    if (!activeBoard) return;
    const name = renameDraft.trim();
    if (!name) return;
    renameBoard(activeBoard.id, name);
    setRenameOpen(false);
  }, [activeBoard, renameBoard, renameDraft]);

  const confirmDelete = useCallback(() => {
    if (!activeBoard || activeBoard.id === MAIN_ANALYSIS_BOARD_ID) return;
    removeBoard(activeBoard.id);
    setDeleteOpen(false);
  }, [activeBoard, removeBoard]);

  return {
    renameOpen,
    setRenameOpen,
    renameDraft,
    setRenameDraft,
    deleteOpen,
    setDeleteOpen,
    openRename,
    confirmRename,
    confirmDelete,
  };
}

export type BoardDialogsController = ReturnType<typeof useBoardDialogs>;
