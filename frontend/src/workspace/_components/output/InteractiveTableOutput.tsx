import { memo, useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Plus } from 'lucide-react';
import type { Output } from '../../_model/output';
import { SelectionToggleButton } from '../SelectionToggleButton';
import {
  applyInteractiveTableState,
  initializeTableSelection,
  normalizeInteractiveTableState,
  toggleSelection,
  withCellEdit,
  type InteractiveTableState,
} from '../../_model/interactiveTableState';
import {
  useInteractiveTableEntry,
  useInteractiveTableRuntime,
} from '../../_model/interactiveTableRuntime';

type Row = Record<string, unknown> & { __row_key: string };
export type { InteractiveTableState } from '../../_model/interactiveTableState';

function compare(left: unknown, right: unknown) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function outputColumns(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map(String).filter((column) => column && column !== '__row_key'))]
    : [];
}

function outputRows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object' && !Array.isArray(row)))
    .map((row, index) => {
      const requested = String(row.__row_key || `source:${index}`);
      const key = used.has(requested) ? `${requested}:${index}` : requested;
      used.add(key);
      return { ...row, __row_key: key };
    });
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export const InteractiveTableOutput = memo(function InteractiveTableOutput({
  output,
  onStateChange,
}: {
  output: Output;
  onStateChange?: (state: InteractiveTableState) => void;
}) {
  const nodeId = String(output.node_id || '');
  const runtime = useInteractiveTableRuntime();
  const entry = useInteractiveTableEntry(nodeId);
  const fallbackRows = useMemo(() => {
    const raw = Array.isArray(output.original_rows) ? output.original_rows : output.rows;
    return outputRows(raw).map((row) => {
      const { __row_key: _rowKey, ...copy } = row;
      return copy;
    });
  }, [output.original_rows, output.rows]);
  const fallbackColumns = useMemo(() => {
    const declared = outputColumns(output.source_columns);
    return declared.length
      ? declared
      : Object.keys(fallbackRows[0] || {}).filter((column) => column !== '__row_key');
  }, [fallbackRows, output.source_columns]);
  const source = entry.source || { rows: fallbackRows, columns: fallbackColumns };
  const persisted = entry.revision
    ? entry.state
    : normalizeInteractiveTableState(output.state);
  const initial = useMemo(
    () => initializeTableSelection(
      persisted,
      source.rows.map((_, index) => `source:${index}`),
      source.columns,
    ),
    [persisted, source],
  );
  const { rows, columns } = useMemo(
    () => applyInteractiveTableState(source.rows, source.columns, initial),
    [initial, source],
  );
  const state = initial;
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const previousValues = recordValue(output.previous_values);

  useEffect(() => {
    if (!persisted.selection_initialized && nodeId) {
      if (runtime) runtime.setState(nodeId, initial);
      else onStateChange?.(initial);
    }
  }, [initial, nodeId, onStateChange, persisted.selection_initialized, runtime]);

  const commit = (update: (current: InteractiveTableState) => InteractiveTableState) => {
    const next = normalizeInteractiveTableState(update(state));
    if (runtime) runtime.setState(nodeId, next);
    else onStateChange?.(next);
  };

  const orderedRows = useMemo(() => {
    if (!sortColumn) return rows;
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => compare(left[sortColumn], right[sortColumn]) * direction);
  }, [rows, sortColumn, sortDirection]);

  const editCell = (rowKey: string, column: string, value: string) => {
    commit((current) => withCellEdit(current, rowKey, column, value));
  };

  const addRow = () => {
    const randomId = globalThis.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const key = `added:${randomId}`;
    const values = Object.fromEntries(columns.map((column) => [column, null]));
    const allRowsSelected = (state.selected_rows || []).length === rows.length;
    commit((current) => ({
      ...current,
      added_rows: [...(current.added_rows || []), { key, values }],
      selected_rows: allRowsSelected
        ? [...(current.selected_rows || []), key]
        : current.selected_rows,
    }));
  };

  const addColumn = () => {
    const proposed = window.prompt('نام ستون جدید را وارد کنید:')?.trim();
    if (!proposed || columns.includes(proposed)) return;
    const allColumnsSelected = (state.selected_columns || []).length === columns.length;
    commit((current) => ({
      ...current,
      added_columns: [...(current.added_columns || []), { name: proposed, default: null }],
      selected_columns: allColumnsSelected
        ? [...(current.selected_columns || []), proposed]
        : current.selected_columns,
    }));
  };

  const toggleRow = (key: string) => {
    commit((current) => {
      return {
        ...current,
        selected_rows: toggleSelection(current.selected_rows, key),
      };
    });
  };

  const toggleColumn = (column: string) => {
    commit((current) => {
      return {
        ...current,
        selected_columns: toggleSelection(current.selected_columns, column),
      };
    });
  };

  return (
    <div className="interactive-table" dir="ltr">
      <div className="interactive-table-toolbar" dir="rtl">
        <button type="button" className="tiny-action" onClick={addRow}><Plus size={12} /> افزودن ردیف</button>
        <button type="button" className="tiny-action" onClick={addColumn}><Plus size={12} /> افزودن ستون</button>
        <SelectionToggleButton items={rows.map((row) => row.__row_key)} selected={state.selected_rows || []} subject="ردیف‌ها" onChange={(selectedRows) => commit((current) => ({ ...current, selection_initialized: true, selected_rows: selectedRows }))} />
        <SelectionToggleButton items={columns} selected={state.selected_columns || []} subject="ستون‌ها" onChange={(selectedColumns) => commit((current) => ({ ...current, selection_initialized: true, selected_columns: selectedColumns }))} />
        <small>تغییرات ذخیره می‌شوند؛ برای ارسال جدول پاک به نود بعدی دوباره اجرا کنید.</small>
      </div>
      <div className="interactive-table-scroll">
        <table>
          <thead>
            <tr>
              <th className="interactive-select-cell">ردیف</th>
              {columns.map((column) => (
                <th key={column} className={(state.selected_columns || []).includes(column) ? 'is-selected' : ''}>
                  <label>
                    <input type="checkbox" checked={(state.selected_columns || []).includes(column)} onChange={() => toggleColumn(column)} />
                    <span>{column}</span>
                  </label>
                  <button
                    type="button"
                    title={`مرتب‌سازی بر اساس ${column}`}
                    onClick={() => {
                      if (sortColumn === column) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc');
                      else {
                        setSortColumn(column);
                        setSortDirection('asc');
                      }
                    }}
                  ><ArrowDownUp size={11} /></button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedRows.map((row) => {
              const selected = (state.selected_rows || []).includes(row.__row_key);
              return (
                <tr key={row.__row_key} className={selected ? 'is-selected' : ''}>
                  <td className="interactive-select-cell">
                    <input type="checkbox" checked={selected} onChange={() => toggleRow(row.__row_key)} />
                  </td>
                  {columns.map((column) => {
                    const changeKey = `${row.__row_key}::${column}`;
                    const changed = Object.prototype.hasOwnProperty.call(previousValues, changeKey)
                      || Object.prototype.hasOwnProperty.call(state.cell_edits?.[row.__row_key] || {}, column);
                    const oldValue = Object.prototype.hasOwnProperty.call(previousValues, changeKey)
                      ? previousValues[changeKey]
                      : source.rows[Number(row.__row_key.replace('source:', ''))]?.[column];
                    return (
                      <td
                        key={column}
                        className={`${changed ? 'is-changed' : ''} ${(state.selected_columns || []).includes(column) ? 'is-selected' : ''}`}
                        title={changed ? `مقدار قبلی: ${String(oldValue ?? '-')}` : String(row[column] ?? '')}
                      >
                        <input
                          value={String(row[column] ?? '')}
                          onChange={(event) => editCell(row.__row_key, column, event.target.value)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
