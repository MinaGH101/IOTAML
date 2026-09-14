import { useCallback, useMemo } from 'react';
import { createOutputReference } from '../../../../features/results/model/outputReference';
import type { Output } from '../../../_model/output';
import { useBoardCollection } from './analysis-boards/useBoardCollection';
import { useBoardItems } from './analysis-boards/useBoardItems';
import { boardPersistenceSignature, serializedBoards as serializeBoards } from './analysis-boards/serializeBoards';
import type { AnalysisBoardsOptions } from './analysis-boards/types';
export function useAnalysisBoards(options: AnalysisBoardsOptions) { const collection = useBoardCollection(options); const createReference = useCallback((output: Output, nodeId: string | null, key: string) => ({ outputRef: createOutputReference(output, options.currentRunId, nodeId, key) }), [options.currentRunId]); const items = useBoardItems(options, collection, createReference); const serializedBoards = useMemo(() => serializeBoards(collection.boards), [collection.boards]); const persistenceSignature = useMemo(() => boardPersistenceSignature(collection.boards), [collection.boards]); return { boards: collection.boards, activeBoard: collection.activeBoard, activeBoardId: collection.activeBoardId, targetBoardId: collection.targetBoardId, restoreBoards: collection.restoreBoards, selectBoard: collection.selectBoard, createBoard: collection.createBoard, renameBoard: collection.renameBoard, removeBoard: collection.removeBoard, ...items, serializedBoards, persistenceSignature }; }
