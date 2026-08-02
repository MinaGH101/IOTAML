import { useSyncExternalStore } from 'react';

export type AtomicStore<T> = {
  getState(): T;
  setState(update: Partial<T> | T | ((state: T) => Partial<T> | T)): void;
  subscribe(listener: () => void): () => void;
};

type StoreSetter<T> = AtomicStore<T>['setState'];

export function createAtomicStore<T>(
  initialize: (set: StoreSetter<T>, get: () => T) => T,
): AtomicStore<T> {
  const listeners = new Set<() => void>();
  let state!: T;

  const store: AtomicStore<T> = {
    getState: () => state,
    setState(update) {
      const patch = typeof update === 'function'
        ? (update as (current: T) => Partial<T> | T)(state)
        : update;
      if (Object.is(patch, state)) return;
      const next = patch && typeof patch === 'object'
        ? { ...state, ...patch }
        : patch as T;
      if (Object.is(next, state)) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  state = initialize(store.setState, store.getState);
  return store;
}

export function useAtomicStore<T, Selected>(
  store: AtomicStore<T>,
  selector: (state: T) => Selected,
): Selected {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
