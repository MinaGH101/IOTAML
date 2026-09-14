export type PersistedCanvasViewport = {
    x: number;
    y: number;
    zoom: number;
};
const STORAGE_PREFIX = 'iota-ml:viewport:v1';
export function normalizeCanvasViewport(value: unknown, fallback: PersistedCanvasViewport): PersistedCanvasViewport {
    const candidate = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Partial<PersistedCanvasViewport>
        : {};
    const x = Number(candidate.x);
    const y = Number(candidate.y);
    const zoom = Number(candidate.zoom);
    return {
        x: Number.isFinite(x) ? x : fallback.x,
        y: Number.isFinite(y) ? y : fallback.y,
        zoom: Number.isFinite(zoom) ? Math.min(2.25, Math.max(0.1, zoom)) : fallback.zoom,
    };
}
export function loadCanvasViewport(key: string, fallback: PersistedCanvasViewport): PersistedCanvasViewport {
    if (typeof window === 'undefined')
        return fallback;
    try {
        const stored = window.localStorage.getItem(`${STORAGE_PREFIX}:${key}`);
        return stored ? normalizeCanvasViewport(JSON.parse(stored), fallback) : fallback;
    }
    catch {
        return fallback;
    }
}
export function saveCanvasViewport(key: string, viewport: PersistedCanvasViewport) {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(`${STORAGE_PREFIX}:${key}`, JSON.stringify(normalizeCanvasViewport(viewport, viewport)));
    }
    catch {
        // Viewport persistence is non-critical when storage is unavailable.
    }
}
