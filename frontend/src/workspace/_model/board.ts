import type { OutputReference } from '../../features/results/model/outputReference';
import type { Output } from './output';

export const ANALYSIS_BOARD_ZOOM_MIN = 0.5;
export const ANALYSIS_BOARD_ZOOM_MAX = 1.5;
export const ANALYSIS_BOARD_ZOOM_STEP = 0.1;

export function normalizeAnalysisBoardZoom(value: unknown, fallback = 1): number {
    const zoom = Number(value);
    return Number.isFinite(zoom)
        ? Math.min(ANALYSIS_BOARD_ZOOM_MAX, Math.max(ANALYSIS_BOARD_ZOOM_MIN, zoom))
        : fallback;
}
export type AnalysisBoardItem = {
    id: string;
    nodeId: string | null;
    outputKey?: string;
    outputIndex: number;
    outputTitle: string;
    outputKind: string;
    /** Current user-assigned name of the workflow node that produced this output. */
    sourceLabel?: string;
    /** Immutable catalog type of the workflow node that produced this output. */
    sourceTypeLabel?: string;
    x: number;
    y: number;
    w: number;
    h: number;
    /** Starts a user-created row; omitted items continue the responsive flow. */
    startsRow?: boolean;
    /** Zoom for the output inside this card, independent of the board zoom. */
    contentZoom?: number;
    runId?: number | null;
    outputRef?: OutputReference;
    /** Legacy compatibility only. New Board items persist outputRef instead. */
    snapshot?: Output;
    createdAt: string;
};
export type BoardViewport = {
    x: number;
    y: number;
    scale: number;
};

export function normalizeBoardViewport(value: unknown, fallback: BoardViewport = { x: 0, y: 0, scale: 1 }): BoardViewport {
    const candidate = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Partial<BoardViewport>
        : {};
    const x = Number(candidate.x);
    const y = Number(candidate.y);
    return {
        x: Number.isFinite(x) ? x : fallback.x,
        y: Number.isFinite(y) ? Math.max(0, y) : fallback.y,
        scale: normalizeAnalysisBoardZoom(candidate.scale, fallback.scale),
    };
}
export type AnalysisBoardTab = {
    id: string;
    name: string;
    locked?: boolean;
    items: AnalysisBoardItem[];
    viewport: BoardViewport;
    createdAt: string;
};
