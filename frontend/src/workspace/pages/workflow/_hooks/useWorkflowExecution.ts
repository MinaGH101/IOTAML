import { useCallback } from 'react';
import type { Run, RunSummary } from '../../../../shared/types';
import { useRunGraph } from './workflow-execution/useRunGraph';
import type { WorkflowExecutionOptions } from './workflow-execution/types';
export function useWorkflowExecution(o: WorkflowExecutionOptions) { const runGraphFromNode = useRunGraph(o); const runWorkflow = useCallback(() => runGraphFromNode(o.selectedId), [o.selectedId, runGraphFromNode]); const retryRun = useCallback((run: Run | RunSummary) => o.retryRunWithSignature(run, o.currentOutputSignature), [o.currentOutputSignature, o.retryRunWithSignature]); return { runGraphFromNode, runWorkflow, retryRun }; }
