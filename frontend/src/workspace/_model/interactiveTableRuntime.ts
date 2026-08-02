import { createContext, useContext, useSyncExternalStore } from 'react';
import {
  EMPTY_INTERACTIVE_TABLE_ENTRY,
  InteractiveTableRuntime,
  type InteractiveTableRuntimeEntry,
} from './interactiveTableStore';

export { InteractiveTableRuntime } from './interactiveTableStore';

export const InteractiveTableRuntimeContext = createContext<InteractiveTableRuntime | null>(null);

export function useInteractiveTableEntry(nodeId: string): InteractiveTableRuntimeEntry {
  const runtime = useContext(InteractiveTableRuntimeContext);
  return useSyncExternalStore(
    (listener) => runtime?.subscribe(nodeId, listener) || (() => undefined),
    () => runtime?.snapshot(nodeId) || EMPTY_INTERACTIVE_TABLE_ENTRY,
    () => runtime?.snapshot(nodeId) || EMPTY_INTERACTIVE_TABLE_ENTRY,
  );
}

export function useInteractiveTableRuntime() {
  return useContext(InteractiveTableRuntimeContext);
}
