import { useEffect, useMemo, useState } from 'react';
import type { Output } from '../../../_model/output';
import { applyInteractiveTableState, initializeTableSelection, normalizeInteractiveTableState, toggleSelection, withCellEdit, type InteractiveTableState } from '../../../_model/interactiveTableState';
import { useInteractiveTableEntry, useInteractiveTableRuntime } from '../../../_model/interactiveTableRuntime';
import { compareTableValues, normalizeOutputColumns, normalizeOutputRows } from '../../../_model/interactiveTableView';
const PAGE_SIZE = 100;
export function useInteractiveTableOutput(output: Output, onStateChange?: (state: InteractiveTableState) => void) {
    const nodeId = String(output.node_id || '');
    const runtime = useInteractiveTableRuntime();
    const entry = useInteractiveTableEntry(nodeId);
    const fallbackRows = useMemo(() => normalizeOutputRows(Array.isArray(output.original_rows) ? output.original_rows : output.rows).map(({ __row_key: _key, ...row }) => row), [output.original_rows, output.rows]);
    const fallbackColumns = useMemo(() => { const declared = normalizeOutputColumns(output.source_columns); return declared.length ? declared : Object.keys(fallbackRows[0] || {}).filter((c) => c !== '__row_key'); }, [fallbackRows, output.source_columns]);
    const source = entry.source || { rows: fallbackRows, columns: fallbackColumns };
    const persisted = entry.revision ? entry.state : normalizeInteractiveTableState(output.state);
    const state = useMemo(() => initializeTableSelection(persisted, source.rows.map((_, i) => `source:${i}`), source.columns), [persisted, source]);
    const { rows, columns } = useMemo(() => applyInteractiveTableState(source.rows, source.columns, state), [source, state]);
    const [sortColumn, setSortColumn] = useState('');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(0);
    const selectedRows = useMemo(() => new Set(state.selected_rows || []), [state.selected_rows]);
    const selectedColumns = useMemo(() => new Set(state.selected_columns || []), [state.selected_columns]);
    useEffect(() => { if (!persisted.selection_initialized && nodeId) {
        if (runtime)
            runtime.setState(nodeId, state);
        else
            onStateChange?.(state);
    } }, [nodeId, onStateChange, persisted.selection_initialized, runtime, state]);
    const commit = (update: (current: InteractiveTableState) => InteractiveTableState) => { const next = normalizeInteractiveTableState(update(state)); if (runtime)
        runtime.setState(nodeId, next);
    else
        onStateChange?.(next); };
    const orderedRows = useMemo(() => !sortColumn ? rows : [...rows].sort((a, b) => compareTableValues(a[sortColumn], b[sortColumn]) * (sortDirection === 'asc' ? 1 : -1)), [rows, sortColumn, sortDirection]);
    const pageCount = Math.max(1, Math.ceil(orderedRows.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount - 1);
    const visibleRows = useMemo(() => orderedRows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE), [currentPage, orderedRows]);
    useEffect(() => { if (page !== currentPage)
        setPage(currentPage); }, [currentPage, page]);
    const editCell = (row: string, col: string, value: string) => commit((s) => withCellEdit(s, row, col, value));
    const toggleRow = (key: string) => commit((s) => ({ ...s, selected_rows: toggleSelection(s.selected_rows, key) }));
    const toggleColumn = (col: string) => commit((s) => ({ ...s, selected_columns: toggleSelection(s.selected_columns, col) }));
    const addRow = () => { const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; const key = `added:${id}`; const all = selectedRows.size === rows.length; commit((s) => ({ ...s, added_rows: [...(s.added_rows || []), { key, values: Object.fromEntries(columns.map((c) => [c, null])) }], selected_rows: all ? [...(s.selected_rows || []), key] : s.selected_rows })); };
    const addColumn = () => { const name = window.prompt('نام ستون جدید را وارد کنید:')?.trim(); if (!name || columns.includes(name))
        return; const all = selectedColumns.size === columns.length; commit((s) => ({ ...s, added_columns: [...(s.added_columns || []), { name, default: null }], selected_columns: all ? [...(s.selected_columns || []), name] : s.selected_columns })); };
    const sort = (col: string) => { setPage(0); if (sortColumn === col)
        setSortDirection((v) => v === 'asc' ? 'desc' : 'asc');
    else {
        setSortColumn(col);
        setSortDirection('asc');
    } };
    return { source, state, rows, columns, selectedRows, selectedColumns, visibleRows, pageCount, currentPage, setPage, commit, editCell, toggleRow, toggleColumn, addRow, addColumn, sort };
}
