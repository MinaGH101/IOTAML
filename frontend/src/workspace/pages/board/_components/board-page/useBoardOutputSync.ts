import { useEffect, useMemo } from 'react';
import { normalizeOutputs } from '../../../../../features/results/components/ResultsPanel';
import { createOutputReference } from '../../../../../features/results/model/outputReference';
import type { Run } from '../../../../../shared/types';
import type { AnalysisBoardItem } from '../../../../_model/board';
import { boardOutputKey, boardOutputTitle, resolveBoardItems } from '../../../../_model/boardOutputs';
export function useBoardOutputSync({ items, run, workflowDirty, active, onUpdateItem }: {
    items: AnalysisBoardItem[];
    run: Run | null;
    workflowDirty: boolean;
    active: boolean;
    onUpdateItem: (id: string, patch: Partial<AnalysisBoardItem>) => void;
}) { const outputs = useMemo(() => normalizeOutputs(run, null), [run]); const resolvedItems = useMemo(() => resolveBoardItems(items, outputs, workflowDirty), [items, outputs, workflowDirty]); useEffect(() => { if (!active || workflowDirty || run?.status !== 'succeeded' || !run.id)
    return; resolvedItems.forEach(({ item, currentOutput }) => { if (!currentOutput)
    return; const nextKey = boardOutputKey(currentOutput); const nextRef = createOutputReference(currentOutput, run.id, item.nodeId, nextKey); const nextKind = String(currentOutput.kind || item.outputKind || 'json'); const nextTitle = boardOutputTitle(currentOutput, item.outputIndex); if (item.runId === run.id
        && item.outputKey === nextKey
        && item.outputKind === nextKind
        && item.outputTitle === nextTitle
        && item.outputRef?.runId === nextRef.runId
        && item.outputRef?.nodeId === nextRef.nodeId
        && item.outputRef?.outputId === nextRef.outputId
        && item.outputRef?.artifactId === nextRef.artifactId
        && item.outputRef?.revision === nextRef.revision)
        return; onUpdateItem(item.id, { outputRef: nextRef, outputKey: nextKey, runId: run.id, outputKind: nextKind, outputTitle: nextTitle }); }); }, [active, onUpdateItem, resolvedItems, run?.id, run?.status, workflowDirty]); return resolvedItems; }
