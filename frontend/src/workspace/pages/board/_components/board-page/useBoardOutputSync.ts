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
    return; resolvedItems.forEach(({ item, currentOutput }) => { if (!currentOutput || item.runId === run.id)
    return; onUpdateItem(item.id, { outputRef: createOutputReference(currentOutput, run.id, item.nodeId, boardOutputKey(currentOutput)), outputKey: boardOutputKey(currentOutput), runId: run.id, outputKind: String(currentOutput.kind || item.outputKind || 'json'), outputTitle: boardOutputTitle(currentOutput, item.outputIndex) }); }); }, [active, onUpdateItem, resolvedItems, run?.id, run?.status, workflowDirty]); return resolvedItems; }
