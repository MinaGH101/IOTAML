export type InteractiveTableState = {
  version?: number;
  selection_initialized?: boolean;
  cell_edits?: Record<string, Record<string, unknown>>;
  added_rows?: Array<{ key: string; values: Record<string, unknown> }>;
  added_columns?: Array<{ name: string; default: unknown }>;
  selected_rows?: string[];
  selected_columns?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(
        value
          .filter((item) => typeof item === 'string' || typeof item === 'number')
          .map(String)
          .filter(Boolean),
      )]
    : [];
}

/**
 * Normalize persisted editor state at the frontend boundary.
 *
 * Old workflow revisions or interrupted saves can contain partial state. The
 * editor must treat omitted fields as empty collections and must never let a
 * malformed persisted value crash the React tree.
 */
export function normalizeInteractiveTableState(value: unknown): InteractiveTableState {
  const source = isRecord(value) ? value : {};
  const edits = isRecord(source.cell_edits)
    ? Object.fromEntries(
        Object.entries(source.cell_edits)
          .filter(([, row]) => isRecord(row))
          .map(([key, row]) => [String(key), { ...(row as Record<string, unknown>) }]),
      )
    : {};
  const addedRows = Array.isArray(source.added_rows)
    ? source.added_rows
        .filter(isRecord)
        .map((row, index) => ({
          key: String(row.key || `added:restored:${index}`),
          values: isRecord(row.values) ? { ...row.values } : {},
        }))
    : [];
  const addedColumns = Array.isArray(source.added_columns)
    ? source.added_columns
        .filter(isRecord)
        .map((column) => ({
          name: String(column.name || '').trim(),
          default: column.default,
        }))
        .filter((column) => column.name)
    : [];
  const selectedRows = stringList(source.selected_rows);
  const selectedColumns = stringList(source.selected_columns);
  return {
    version: 1,
    selection_initialized: source.selection_initialized === true
      || selectedRows.length > 0
      || selectedColumns.length > 0,
    cell_edits: edits,
    added_rows: addedRows,
    added_columns: addedColumns,
    selected_rows: selectedRows,
    selected_columns: selectedColumns,
  };
}

export function initializeTableSelection(
  state: InteractiveTableState,
  rowKeys: string[],
  columns: string[],
): InteractiveTableState {
  const normalized = normalizeInteractiveTableState(state);
  if (normalized.selection_initialized) return normalized;
  return {
    ...normalized,
    selection_initialized: true,
    selected_rows: [...rowKeys],
    selected_columns: [...columns],
  };
}

export function applyInteractiveTableState(
  sourceRows: Record<string, unknown>[],
  sourceColumns: string[],
  value: InteractiveTableState,
) {
  const state = normalizeInteractiveTableState(value);
  const columns = [...sourceColumns];
  const rows = sourceRows.map((row, index) => ({
    __row_key: `source:${index}`,
    ...row,
  }));

  (state.added_columns || []).forEach((definition) => {
    if (!definition.name || columns.includes(definition.name)) return;
    columns.push(definition.name);
    rows.forEach((row) => {
      row[definition.name] = definition.default;
    });
  });
  (state.added_rows || []).forEach((addition) => {
    rows.push({
      __row_key: addition.key,
      ...Object.fromEntries(columns.map((column) => [column, addition.values[column] ?? null])),
    });
  });
  const byKey = new Map(rows.map((row) => [String(row.__row_key), row]));
  Object.entries(state.cell_edits || {}).forEach(([rowKey, edits]) => {
    const row = byKey.get(rowKey);
    if (!row) return;
    Object.entries(edits).forEach(([column, cell]) => {
      if (columns.includes(column)) row[column] = cell;
    });
  });

  const initialized = state.selection_initialized === true;
  const selectedRows = new Set(state.selected_rows || []);
  const selectedColumns = new Set(state.selected_columns || []);
  const resultColumns = initialized
    ? columns.filter((column) => selectedColumns.has(column))
    : columns;
  const resultRows = (initialized
    ? rows.filter((row) => selectedRows.has(String(row.__row_key)))
    : rows
  ).map((row) => Object.fromEntries(resultColumns.map((column) => [column, row[column]])));

  return { rows, columns, resultRows, resultColumns };
}

export function withCellEdit(
  state: InteractiveTableState,
  rowKey: string,
  column: string,
  value: unknown,
): InteractiveTableState {
  return {
    ...state,
    version: 1,
    cell_edits: {
      ...(state.cell_edits || {}),
      [rowKey]: { ...(state.cell_edits?.[rowKey] || {}), [column]: value },
    },
  };
}

export function toggleSelection(values: string[] | undefined, value: string) {
  const current = values || [];
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}
