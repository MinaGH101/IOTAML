import { useMemo, useState } from 'react';
import type { Run, RunSummary } from '../../../../shared/types';
import type { RunProgressTransportState } from '../../../../features/execution/model/runProgressTransport';
import { retainRunDisplayState } from '../../../_model/runtimeContext';
import { useRunActions } from './run-history/useRunActions';
import { terminalRunStatuses } from './run-history/model';
import { useRunProgress } from './run-history/useRunProgress';
export { terminalRunStatuses } from './run-history/model';
export type { RunReference } from './run-history/model';
export function useRunHistory({ projectId, setMessage }: {
    projectId: number;
    setMessage: (message: string) => void;
}) { const [currentRun, setCurrentRun] = useState<Run | null>(null); const [nodeStateRun, setNodeStateRun] = useState<Run | null>(null); const [workflowLastRunId, setWorkflowLastRunId] = useState<number | null>(null); const [runHistory, setRunHistory] = useState<RunSummary[]>([]); const [busy, setBusy] = useState(false); const [lastRunSignature, setLastRunSignature] = useState(''); const [progressTransportState, setProgressTransportState] = useState<RunProgressTransportState>('closed'); const actions = useRunActions(projectId, setMessage, setCurrentRun, setRunHistory, setBusy, setLastRunSignature); useRunProgress(currentRun, setCurrentRun, setNodeStateRun, setWorkflowLastRunId, setRunHistory, setBusy, setProgressTransportState, actions.refreshRunHistory, setMessage); const displayRun = useMemo(() => !currentRun ? nodeStateRun : currentRun.status === 'succeeded' ? nodeStateRun || currentRun : retainRunDisplayState(nodeStateRun, currentRun), [currentRun, nodeStateRun]); return { currentRun, setCurrentRun, nodeStateRun, setNodeStateRun, displayRun, workflowLastRunId, setWorkflowLastRunId, runHistory, setRunHistory, busy, setBusy, lastRunSignature, setLastRunSignature, ...actions, progressTransportState }; }
