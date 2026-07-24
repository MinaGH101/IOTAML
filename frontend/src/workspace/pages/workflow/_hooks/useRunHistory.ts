import { useCallback, useEffect, useState } from 'react';
import type { Run, RunSummary } from '../../../../shared/_types';
import { workspaceApi } from '../../../_service/workspaceApi';
import { mergeRunProgress, upsertRunSummary } from '../../../_model/runtimeContext';

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
    if (!runId || terminalRunStatuses.has(currentRun.status)) {
      setBusy(false);
      return undefined;
    }

    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      try {
        const snapshot = await workspaceApi.runProgress(runId);
        if (cancelled) return;
        if (terminalRunStatuses.has(snapshot.status)) {
          const completed = await workspaceApi.getRun(runId);
          if (cancelled) return;
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
        timer = window.setTimeout(poll, snapshot.status === 'queued' ? 900 : 650);
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : 'دریافت وضعیت اجرا ناموفق بود');
        timer = window.setTimeout(poll, 1500);
      }
    };

    timer = window.setTimeout(poll, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
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
  };
}
