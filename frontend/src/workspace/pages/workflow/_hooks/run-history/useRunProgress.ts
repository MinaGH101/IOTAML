import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { runsApi } from '../../../../../features/execution/api/runsApi';
import { createRunProgressTransport, type RunProgressTransportState } from '../../../../../features/execution/model/runProgressTransport';
import type { Run, RunSummary } from '../../../../../shared/types';
import { mergePersistentNodeState, mergeRunProgress, retainRunDisplayState, upsertRunSummary } from '../../../../_model/runtimeContext';
import { terminalRunStatuses } from './model';
export function useRunProgress(currentRun: Run | null, setCurrentRun: Dispatch<SetStateAction<Run | null>>, setNodeStateRun: Dispatch<SetStateAction<Run | null>>, setWorkflowLastRunId: Dispatch<SetStateAction<number | null>>, setRunHistory: Dispatch<SetStateAction<RunSummary[]>>, setBusy: Dispatch<SetStateAction<boolean>>, setProgress: Dispatch<SetStateAction<RunProgressTransportState>>, refresh: () => Promise<void>, setMessage: (m: string) => void) { const lastError = useRef(''); useEffect(() => { const runId = currentRun?.id; const status = currentRun?.status; if (!runId || !status || terminalRunStatuses.has(status)) {
    setBusy(false);
    setProgress('closed');
    return;
} const transport = createRunProgressTransport({ runId, initialStatus: status, isTerminal: (s) => terminalRunStatuses.has(s), onStateChange: setProgress, onError: (e) => { const m = e instanceof Error ? e.message : 'دریافت وضعیت اجرا ناموفق بود'; if (m !== lastError.current) {
        lastError.current = m;
        setMessage(m);
    } }, onSnapshot: async (snapshot) => { lastError.current = ''; if (terminalRunStatuses.has(snapshot.status)) {
        const done = await runsApi.get(runId);
        setCurrentRun((p) => retainRunDisplayState(p, done));
        if (done.status === 'succeeded') {
            setWorkflowLastRunId(done.id);
            setNodeStateRun((p) => mergePersistentNodeState(p, done));
        }
        setRunHistory((items) => upsertRunSummary(items, done));
        setBusy(false);
        void refresh();
        return;
    } setCurrentRun((run) => run && run.id === runId ? mergeRunProgress(run, snapshot) : run); } }); return () => transport.close(); }, [currentRun?.id, currentRun?.status, refresh, setBusy, setCurrentRun, setMessage, setNodeStateRun, setProgress, setRunHistory, setWorkflowLastRunId]); }
