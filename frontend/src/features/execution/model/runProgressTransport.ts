import type { RunProgressSnapshot } from '../../../shared/_types';
import { runsApi } from '../api/runsApi';
import { pollingDelay } from './pollingPolicy';

export type RunProgressTransportState = 'connecting' | 'polling' | 'paused' | 'closed';

export type RunProgressTransport = {
  close(): void;
};

export type RunProgressTransportOptions = {
  runId: number;
  initialStatus: string;
  onSnapshot(snapshot: RunProgressSnapshot): void | Promise<void>;
  onError(error: unknown): void;
  onStateChange?(state: RunProgressTransportState): void;
  isTerminal(status: string): boolean;
};

/**
 * A single abortable progress channel for one active run.
 * The current backend exposes polling only. The interface deliberately matches
 * a future SSE/WebSocket adapter so consumers do not need another rewrite.
 */
export function createRunProgressTransport(options: RunProgressTransportOptions): RunProgressTransport {
  let closed = false;
  let status = options.initialStatus;
  let failureCount = 0;
  let timer: number | undefined;
  let request: AbortController | undefined;

  const clear = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
    request?.abort();
    request = undefined;
  };

  const schedule = (delay: number) => {
    if (closed || options.isTerminal(status)) return;
    if (document.visibilityState === 'hidden') {
      options.onStateChange?.('paused');
      return;
    }
    timer = window.setTimeout(poll, delay);
  };

  const poll = async () => {
    if (closed || options.isTerminal(status)) return;
    if (document.visibilityState === 'hidden') {
      options.onStateChange?.('paused');
      return;
    }
    options.onStateChange?.('polling');
    const controller = new AbortController();
    request = controller;
    try {
      const snapshot = await runsApi.progress(options.runId, controller.signal);
      if (closed) return;
      failureCount = 0;
      status = snapshot.status;
      await options.onSnapshot(snapshot);
      schedule(pollingDelay(status, 0));
    } catch (error) {
      if (closed || controller.signal.aborted) return;
      failureCount += 1;
      options.onError(error);
      schedule(pollingDelay(status, failureCount));
    } finally {
      if (request === controller) request = undefined;
    }
  };

  const onVisibilityChange = () => {
    if (closed) return;
    if (document.visibilityState === 'hidden') {
      clear();
      options.onStateChange?.('paused');
      return;
    }
    clear();
    schedule(0);
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  options.onStateChange?.('connecting');
  schedule(120);

  return {
    close() {
      if (closed) return;
      closed = true;
      clear();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      options.onStateChange?.('closed');
    },
  };
}
