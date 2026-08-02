import { useCallback, useEffect, useRef, useState } from 'react';

export type QueryKey = readonly unknown[];
type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

type CacheEntry<T> = {
  data?: T;
  error?: unknown;
  status: QueryStatus;
  updatedAt: number;
  promise?: Promise<T>;
  controller?: AbortController;
  subscribers: Set<() => void>;
};

const cache = new Map<string, CacheEntry<unknown>>();

function keyOf(key: QueryKey) {
  return JSON.stringify(key);
}

function entryFor<T>(key: QueryKey): CacheEntry<T> {
  const cacheKey = keyOf(key);
  let entry = cache.get(cacheKey) as CacheEntry<T> | undefined;
  if (!entry) {
    entry = { status: 'idle', updatedAt: 0, subscribers: new Set() };
    cache.set(cacheKey, entry as CacheEntry<unknown>);
  }
  return entry;
}

function publish(entry: CacheEntry<unknown>) {
  entry.subscribers.forEach((subscriber) => subscriber());
}

async function execute<T>(key: QueryKey, queryFn: (signal: AbortSignal) => Promise<T>, force = false) {
  const entry = entryFor<T>(key);
  if (entry.promise && !force) return entry.promise;
  if (force) entry.controller?.abort(new DOMException('Superseded', 'AbortError'));
  const controller = new AbortController();
  entry.controller = controller;
  entry.status = entry.data === undefined ? 'loading' : 'success';
  publish(entry as CacheEntry<unknown>);
  const promise = queryFn(controller.signal)
    .then((data) => {
      entry.data = data;
      entry.error = undefined;
      entry.status = 'success';
      entry.updatedAt = Date.now();
      return data;
    })
    .catch((error) => {
      if (controller.signal.aborted) {
        entry.status = entry.data === undefined ? 'idle' : 'success';
        throw error;
      }
      entry.error = error;
      entry.status = 'error';
      throw error;
    })
    .finally(() => {
      if (entry.controller === controller) entry.controller = undefined;
      entry.promise = undefined;
      publish(entry as CacheEntry<unknown>);
    });
  entry.promise = promise;
  return promise;
}

export function invalidateQueries(prefix: QueryKey) {
  const encodedPrefix = JSON.stringify(prefix).slice(0, -1);
  cache.forEach((entry, key) => {
    if (key.startsWith(encodedPrefix)) {
      entry.updatedAt = 0;
      publish(entry);
    }
  });
}

export function clearServerQueryCache() {
  cache.forEach((entry) => entry.controller?.abort(new DOMException('Cache cleared', 'AbortError')));
  cache.clear();
}

export function useServerQuery<T>({ key, queryFn, enabled = true, staleTime = 30_000 }: {
  key: QueryKey;
  queryFn: (signal: AbortSignal) => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
}) {
  const stableKey = keyOf(key);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;
  const [, forceRender] = useState(0);
  const entry = entryFor<T>(key);

  useEffect(() => {
    const subscriber = () => forceRender((value) => value + 1);
    entry.subscribers.add(subscriber);
    return () => {
      entry.subscribers.delete(subscriber);
      if (entry.subscribers.size === 0) entry.controller?.abort(new DOMException('No active subscribers', 'AbortError'));
    };
  }, [entry, stableKey]);

  useEffect(() => {
    if (!enabled) return;
    const stale = Date.now() - entry.updatedAt > staleTime;
    if (entry.status === 'idle' || stale) void execute(key, (signal) => queryFnRef.current(signal)).catch(() => undefined);
  }, [enabled, entry, stableKey, staleTime]);

  const refetch = useCallback(() => execute(key, (signal) => queryFnRef.current(signal), true), [stableKey]);
  return {
    data: entry.data,
    error: entry.error,
    status: entry.status,
    isLoading: entry.status === 'loading' && entry.data === undefined,
    isFetching: Boolean(entry.promise),
    refetch,
  };
}
