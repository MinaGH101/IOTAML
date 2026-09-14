export type InteractiveRow = Record<string, unknown> & {
    __row_key: string;
};
export function compareTableValues(left: unknown, right: unknown): number {
    return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
        numeric: true,
        sensitivity: 'base',
    });
}
export function normalizeOutputColumns(value: unknown): string[] {
    return Array.isArray(value)
        ? [...new Set(value.map(String).filter((column) => column && column !== '__row_key'))]
        : [];
}
export function normalizeOutputRows(value: unknown): InteractiveRow[] {
    if (!Array.isArray(value))
        return [];
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
export function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}
export function sourceRowIndex(rowKey: string): number | null {
    const match = /^source:(\d+)$/.exec(rowKey);
    if (!match)
        return null;
    const index = Number(match[1]);
    return Number.isInteger(index) ? index : null;
}
