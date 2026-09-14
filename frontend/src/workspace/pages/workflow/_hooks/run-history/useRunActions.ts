import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { runsApi } from '../../../../../features/execution/api/runsApi';
import type { Run, RunSummary } from '../../../../../shared/types';
import { retainRunDisplayState, upsertRunSummary } from '../../../../_model/runtimeContext';
import { terminalRunStatuses, type RunReference } from './model';
export function useRunActions(projectId: number, setMessage: (m: string) => void, setCurrentRun: Dispatch<SetStateAction<Run | null>>, setRunHistory: Dispatch<SetStateAction<RunSummary[]>>, setBusy: Dispatch<SetStateAction<boolean>>, setLastRunSignature: Dispatch<SetStateAction<string>>) { const refreshRunHistory = useCallback(async () => setRunHistory(await runsApi.list(projectId)), [projectId, setRunHistory]); const recordRun = useCallback((run: Run) => { setCurrentRun((p) => retainRunDisplayState(p, run)); setRunHistory((items) => upsertRunSummary(items, run)); }, [setCurrentRun, setRunHistory]); const retryRun = useCallback(async (run: RunReference, signature: string) => { setBusy(true); setMessage('اجرای قبلی دوباره در صف قرار گرفت'); try {
    const next = await runsApi.retry(run.id);
    setCurrentRun((p) => retainRunDisplayState(p, next));
    setRunHistory((items) => upsertRunSummary(items, next));
    setLastRunSignature(signature);
}
catch (e) {
    setMessage(e instanceof Error ? e.message : 'اجرای دوباره ناموفق بود');
    setBusy(false);
} }, [setBusy, setCurrentRun, setLastRunSignature, setMessage, setRunHistory]); const cancelRun = useCallback(async (run: RunReference) => { if (terminalRunStatuses.has(run.status))
    return; setMessage('درخواست توقف اجرا ارسال شد'); try {
    const cancelled = await runsApi.cancel(run.id);
    setCurrentRun((p) => retainRunDisplayState(p, cancelled));
    setRunHistory((items) => upsertRunSummary(items, cancelled));
}
catch (e) {
    setMessage(e instanceof Error ? e.message : 'توقف اجرا ناموفق بود');
} }, [setCurrentRun, setMessage, setRunHistory]); const selectHistoricalRun = useCallback(async (run: RunSummary) => { setMessage('در حال دریافت خروجی اجرای قبلی…'); try {
    const full = await runsApi.get(run.id);
    setCurrentRun(full);
    setBusy(!terminalRunStatuses.has(full.status));
    setMessage('خروجی اجرای قبلی برای Debug نمایش داده شد');
}
catch (e) {
    setMessage(e instanceof Error ? e.message : 'دریافت اجرای قبلی ناموفق بود');
} }, [setBusy, setCurrentRun, setMessage]); return { refreshRunHistory, recordRun, retryRun, cancelRun, selectHistoricalRun }; }
