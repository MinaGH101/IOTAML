import type { AnalysisBoardItem } from '../../../_model/board';

export type BoardRow = { items: AnalysisBoardItem[]; height: number };
/** A placement inside an existing row, or a deliberate row break beside it. */
export type BoardItemPlacement = {
    targetId: string;
    after: boolean;
    newRow?: boolean;
};
export const BOARD_COLUMNS = 4;
export const BOARD_BASE_WIDTH = 440;
export const BOARD_GAP = 10;
export const BOARD_MIN_WIDTH = 180;
export const BOARD_MIN_DISPLAY_WIDTH = 180;
export const BOARD_MAX_WIDTH = BOARD_BASE_WIDTH * BOARD_COLUMNS;
export const BOARD_MIN_HEIGHT = 180;
export const BOARD_MAX_HEIGHT = 1600;

export function clampBoardWidth(width: number, unitWidth?: number, columns = BOARD_COLUMNS, maxWidth = Math.min(BOARD_MAX_WIDTH, BOARD_BASE_WIDTH * columns)): number {
    const maximum = Math.max(BOARD_MIN_WIDTH, maxWidth);
    const minimum = unitWidth ? Math.min(maximum, Math.max(BOARD_MIN_WIDTH, BOARD_MIN_DISPLAY_WIDTH * BOARD_BASE_WIDTH / unitWidth)) : BOARD_MIN_WIDTH;
    return Math.round(Math.min(maximum, Math.max(minimum, width)));
}

export function clampBoardHeight(height: number): number {
    return Math.round(Math.min(BOARD_MAX_HEIGHT, Math.max(BOARD_MIN_HEIGHT, height)));
}

export function boardUnitWidth(availableWidth: number, columns: number): number {
    return Math.max(1, (availableWidth - BOARD_GAP * (columns - 1)) / columns);
}

/** Keep the zoomed board as wide as its viewport so its free space remains usable. */
export function boardLayoutWidth(availableWidth: number, zoom: number): number {
    return availableWidth / Math.min(1, Math.max(0.01, zoom));
}

export function boardDisplayWidth(width: number, unitWidth: number, availableWidth: number): number {
    return Math.min(availableWidth, Math.max(BOARD_MIN_DISPLAY_WIDTH, width / BOARD_BASE_WIDTH * unitWidth));
}

/** Resize a shared boundary without changing the pair's combined width. */
export function resizeBoardPair(width: number, neighborWidth: number, requestedWidth: number, unitWidth: number, columns: number, maxWidth = BOARD_MAX_WIDTH) {
    const total = width + neighborWidth;
    const minimum = clampBoardWidth(-Infinity, unitWidth, columns);
    const maximum = clampBoardWidth(Infinity, unitWidth, columns, maxWidth);
    const lower = Math.max(minimum, total - maximum);
    const upper = Math.min(maximum, total - minimum);
    if (lower > upper) return { width, neighborWidth };
    const nextWidth = Math.round(Math.max(lower, Math.min(upper, requestedWidth)));
    return { width: nextWidth, neighborWidth: total - nextWidth };
}

/** Keep order while wrapping at the available width and at most four cards per row. */
export function arrangeBoardRows(items: AnalysisBoardItem[], availableWidth: number, columns = BOARD_COLUMNS, unitWidth = boardUnitWidth(availableWidth, columns)): BoardRow[] {
    if (!items.length) return [];
    const width = Math.max(1, availableWidth);
    const rows: BoardRow[] = [];
    let pending: AnalysisBoardItem[] = [];
    let occupied = 0;
    const addRow = () => {
        if (!pending.length) return;
        rows.push({ items: pending, height: Math.max(...pending.map((item) => item.h)) });
        pending = [];
        occupied = 0;
    };
    for (const item of items) {
        const displayWidth = boardDisplayWidth(item.w, unitWidth, width);
        if (pending.length && (item.startsRow || pending.length >= columns || occupied + BOARD_GAP + displayWidth > width + 1)) addRow();
        occupied += (pending.length ? BOARD_GAP : 0) + displayWidth;
        pending.push(item);
    }
    addRow();
    return rows;
}

/** Largest width this card can take without moving its row's other cards. */
export function boardOuterWidthLimit(row: BoardRow | undefined, itemId: string, layoutWidth: number, unitWidth: number): number {
    if (!row) return BOARD_MAX_WIDTH;
    const otherWidth = row.items.reduce((sum, item) => sum + (item.id === itemId ? 0 : boardDisplayWidth(item.w, unitWidth, layoutWidth)), 0);
    const space = layoutWidth - otherWidth - BOARD_GAP * (row.items.length - 1);
    return Math.max(BOARD_MIN_WIDTH, Math.floor(space * BOARD_BASE_WIDTH / unitWidth));
}

function normalizePlacement(target: BoardItemPlacement | string, after = false): BoardItemPlacement {
    return typeof target === 'string' ? { targetId: target, after } : target;
}

function withStart(item: AnalysisBoardItem, startsRow: boolean): AnalysisBoardItem {
    if (Boolean(item.startsRow) === startsRow)
        return item;
    return { ...item, startsRow: startsRow || undefined };
}

/**
 * Reorder a card while preserving the manual row boundaries left behind by a
 * moved card. A row boundary moves with the first card in that row when a
 * card is inserted at its start.
 */
export function moveBoardItem(items: AnalysisBoardItem[], sourceId: string, target: BoardItemPlacement | string, after = false): AnalysisBoardItem[] {
    const placement = normalizePlacement(target, after);
    if (sourceId === placement.targetId) return items;
    const source = items.findIndex((item) => item.id === sourceId);
    if (source < 0 || !items.some((item) => item.id === placement.targetId)) return items;
    const next = [...items];
    const [moved] = next.splice(source, 1);
    if (moved.startsRow && next[source] && !next[source].startsRow)
        next[source] = withStart(next[source], true);
    const targetIndex = next.findIndex((item) => item.id === placement.targetId);
    const targetItem = next[targetIndex];
    let inserted = withStart(moved, Boolean(placement.newRow));
    if (!placement.newRow && !placement.after && targetItem.startsRow) {
        inserted = withStart(inserted, true);
        next[targetIndex] = withStart(targetItem, false);
    }
    next.splice(targetIndex + (placement.after ? 1 : 0), 0, inserted);
    return next;
}

export function insertBoardItem(items: AnalysisBoardItem[], item: AnalysisBoardItem, target?: BoardItemPlacement | string | null, after = false): AnalysisBoardItem[] {
    if (!target) return [...items, item];
    const placement = normalizePlacement(target, after);
    const index = items.findIndex((entry) => entry.id === placement.targetId);
    if (index < 0) return [...items, item];
    const next = [...items];
    const targetItem = next[index];
    let inserted = withStart(item, Boolean(placement.newRow));
    if (!placement.newRow && !placement.after && targetItem.startsRow) {
        inserted = withStart(inserted, true);
        next[index] = withStart(targetItem, false);
    }
    next.splice(index + (placement.after ? 1 : 0), 0, inserted);
    return next;
}
