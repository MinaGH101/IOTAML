import type { Node } from '@xyflow/react';
import type { Output } from './output';
import { normalizeInteractiveTableState, type InteractiveTableState, } from './interactiveTableState.ts';
export type InteractiveTableSource = {
    rows: Record<string, unknown>[];
    columns: string[];
};
export type InteractiveTableRuntimeEntry = {
    state: InteractiveTableState;
    source: InteractiveTableSource | null;
    revision: number;
};
type PersistState = (nodeId: string, state: InteractiveTableState) => void;
export const EMPTY_INTERACTIVE_TABLE_ENTRY: InteractiveTableRuntimeEntry = {
    state: normalizeInteractiveTableState({}),
    source: null,
    revision: 0,
};
function signature(value: unknown) {
    return JSON.stringify(value);
}
function sourceFromOutput(output: Output): InteractiveTableSource | null {
    if (String(output.kind || '') !== 'interactive_table')
        return null;
    const rawRows = Array.isArray(output.original_rows) ? output.original_rows : output.rows;
    if (!Array.isArray(rawRows))
        return null;
    const rows = rawRows
        .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object' && !Array.isArray(row)))
        .map((row) => {
        const copy = { ...row };
        delete copy.__row_key;
        return copy;
    });
    const declared = Array.isArray(output.source_columns) ? output.source_columns.map(String) : [];
    const columns = declared.length
        ? declared
        : Object.keys(rows[0] || {}).filter((column) => column !== '__row_key');
    return { rows, columns };
}
/** Node-scoped shared state with isolated subscriptions and debounced persistence. */
export class InteractiveTableRuntime {
    private entries = new Map<string, InteractiveTableRuntimeEntry>();
    private listeners = new Map<string, Set<() => void>>();
    private timers = new Map<string, ReturnType<typeof setTimeout>>();
    private writtenSignatures = new Map<string, string>();
    private persist: PersistState = () => undefined;
    private scope = '';
    configure(scope: string, persist: PersistState) {
        if (scope !== this.scope) {
            this.scope = scope;
            this.entries.clear();
            this.writtenSignatures.clear();
            this.timers.forEach((timer) => clearTimeout(timer));
            this.timers.clear();
        }
        this.persist = persist;
    }
    subscribe = (nodeId: string, listener: () => void) => {
        const current = this.listeners.get(nodeId) || new Set();
        current.add(listener);
        this.listeners.set(nodeId, current);
        return () => {
            current.delete(listener);
            if (!current.size)
                this.listeners.delete(nodeId);
        };
    };
    snapshot = (nodeId: string) => this.entries.get(nodeId) || EMPTY_INTERACTIVE_TABLE_ENTRY;
    private publish(nodeId: string, entry: InteractiveTableRuntimeEntry) {
        this.entries.set(nodeId, entry);
        this.listeners.get(nodeId)?.forEach((listener) => listener());
    }
    hydrateNodes(nodes: Node[]) {
        nodes.forEach((node) => {
            if (String(node.data?.registryId || node.data?.catalogId || '') !== 'UT-008')
                return;
            const state = normalizeInteractiveTableState((node.data?.params as Record<string, unknown> | undefined)?.table_state);
            const incomingSignature = signature(state);
            if (incomingSignature === this.writtenSignatures.get(node.id))
                return;
            const current = this.snapshot(node.id);
            if (signature(current.state) === incomingSignature)
                return;
            this.publish(node.id, { ...current, state, revision: current.revision + 1 });
        });
    }
    hydrateOutputs(outputs: Output[]) {
        outputs.forEach((output) => {
            const nodeId = String(output.node_id || '');
            const source = nodeId ? sourceFromOutput(output) : null;
            if (!nodeId || !source)
                return;
            const current = this.snapshot(nodeId);
            if (signature(current.source) === signature(source))
                return;
            this.publish(nodeId, { ...current, source, revision: current.revision + 1 });
        });
    }
    setState(nodeId: string, value: InteractiveTableState) {
        const state = normalizeInteractiveTableState(value);
        const current = this.snapshot(nodeId);
        if (signature(current.state) === signature(state))
            return;
        this.writtenSignatures.set(nodeId, signature(state));
        this.publish(nodeId, { ...current, state, revision: current.revision + 1 });
        const previous = this.timers.get(nodeId);
        if (previous)
            clearTimeout(previous);
        this.timers.set(nodeId, setTimeout(() => {
            this.timers.delete(nodeId);
            this.persist(nodeId, state);
        }, 180));
    }
    dispose() {
        this.timers.forEach((timer) => clearTimeout(timer));
        this.timers.clear();
        this.listeners.clear();
    }
}
