export type Row = Record<string, unknown>;
export type SortState = {
    field: string;
    direction: 'asc' | 'desc';
} | null;
export const PAGE_SIZES = [5, 10, 12, 25, 50, 100] as const;
export function formatCell(value: unknown) { if (typeof value === 'number')
    return Number.isInteger(value) ? value.toLocaleString('fa-IR') : value.toLocaleString('en-US', { maximumFractionDigits: 4 }); if (value == null)
    return '-'; return String(value); }
export function initialPageSize(n: number) { if (n <= 5)
    return 5; if (n <= 10)
    return 10; if (n <= 12)
    return 12; return 25; }
export function compareValues(a: unknown, b: unknown) { if (a === b)
    return 0; if (a == null)
    return 1; if (b == null)
    return -1; if (typeof a === 'number' && typeof b === 'number')
    return a - b; return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }); }
export function nextSort(s: SortState, f: string): SortState { if (!s || s.field !== f)
    return { field: f, direction: 'asc' }; if (s.direction === 'asc')
    return { field: f, direction: 'desc' }; return null; }
