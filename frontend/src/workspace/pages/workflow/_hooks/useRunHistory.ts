import { useCallback, useEffect, useRef, useState } from 'react';
import type { Run, RunSummary } from '../../../../shared/_types';
import { workspaceApi } from '../../../_service/workspaceApi';
import { mergeRunProgress, upsertRunSummary } from '../../../_model/runtimeContext';
import { createRunProgressTransport, type RunProgressTransportState } from '../../../../features/execution/model/runProgressTransport';

export const terminalRunStatuses = new Set([
  'succeeded',
  'failed',
  'cancelled',
  'timed_out',
]);

export type RunReference = Pick<Run, 'id' | 'status'> | RunSummary;

export function useRunHistory({
  projectId,
  setMessage,
}: {
  projectId: number;
  setMessage: (message: string) => void;
}) {
  const [currentRun, setCurrentRun] = useState<Run | null>(null);
  const [workflowLastRunId, setWorkflowLastRunId] = useState<number | null>(null);
  const [runHistory, setRunHistory] = useState<RunSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastRunSignature, setLastRunSignature] = useState('');
  const [progressTransportState, setProgressTransportState] = useState<RunProgressTransportState>('closed');
  const lastProgressErrorRef = useRef('');

  const refreshRunHistory = useCallback(async () => {
    const runs = await workspaceApi.listRuns(projectId);
    setRunHistory(runs);
  }, [projectId]);

  const recordRun = useCallback((run: Run) => {
    setCurrentRun(run);
    setRunHistory((items) => upsertRunSummary(items, run));
  }, []);

  const retryRun = useCallback(async (run: RunReference, outputSignature: string) => {
    setBusy(true);
    setMessage('اجرای قبلی دوباره در صف قرار گرفت');
    try {
      const nextRun = await workspaceApi.retryRun(run.id);
      setCurrentRun(nextRun);
      setRunHistory((items) => upsertRunSummary(items, nextRun));
      setLastRunSignature(outputSignature);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'اجرای دوباره ناموفق بود');
      setBusy(false);
    }
  }, [setMessage]);

  const cancelRun = useCallback(async (run: RunReference) => {
    if (terminalRunStatuses.has(run.status)) return;
    setMessage('درخواست توقف اجرا ارسال شد');
    try {
      const cancelled = await workspaceApi.cancelRun(run.id);
      setCurrentRun(cancelled);
      setRunHistory((items) => upsertRunSummary(items, cancelled));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'توقف اجرا ناموفق بود');
    }
  }, [setMessage]);

  const selectHistoricalRun = useCallback(async (run: RunSummary) => {
    setMessage('در حال دریافت خروجی اجرای قبلی…');
    try {
      const fullRun = await workspaceApi.getRun(run.id);
      setCurrentRun(fullRun);
      setBusy(!terminalRunStatuses.has(fullRun.status));
      setMessage('خروجی اجرای قبلی برای Debug نمایش داده شد');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'دریافت اجرای قبلی ناموفق بود');
    }
  }, [setMessage]);

  useEffect(() => {
    const runId = currentRun?.id;
    const initialStatus = currentRun?.status;
    if (!runId || !initialStatus || terminalRunStatuses.has(initialStatus)) {
      setBusy(false);
      setProgressTransportState('closed');
      return undefined;
    }

    const transport = createRunProgressTransport({
      runId,
      initialStatus,
      isTerminal: (status) => terminalRunStatuses.has(status),
      onStateChange: setProgressTransportState,
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'دریافت وضعیت اجرا ناموفق بود';
        if (message !== lastProgressErrorRef.current) {
          lastProgressErrorRef.current = message;
          setMessage(message);
        }
      },
      onSnapshot: async (snapshot) => {
        lastProgressErrorRef.current = '';
        if (terminalRunStatuses.has(snapshot.status)) {
          const completed = await workspaceApi.getRun(runId);
          setCurrentRun(completed);
          if (completed.status === 'succeeded') setWorkflowLastRunId(completed.id);
          setRunHistory((items) => upsertRunSummary(items, completed));
          setBusy(false);
          void refreshRunHistory();
          return;
        }
        setCurrentRun((run) => (
          run && run.id === runId ? mergeRunProgress(run, snapshot) : run
        ));
      },
    });

    return () => transport.close();
  }, [currentRun?.id, currentRun?.status, refreshRunHistory, setMessage]);

  return {
    currentRun,
    setCurrentRun,
    workflowLastRunId,
    setWorkflowLastRunId,
    runHistory,
    setRunHistory,
    busy,
    setBusy,
    lastRunSignature,
    setLastRunSignature,
    refreshRunHistory,
    recordRun,
    retryRun,
    cancelRun,
    selectHistoricalRun,
    progressTransportState,
  };
}
