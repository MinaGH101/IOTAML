import type { BoardViewport } from '../../../../_model/board';
import { loadCanvasViewport } from '../../../../_model/viewportStorage';
import { clamp } from '../../_utils/boardInteraction';
export function zoomAt(v: BoardViewport, nextScale: number, originX: number, originY: number): BoardViewport { const scale = clamp(nextScale, .35, 2.25); const worldX = (originX - v.x) / v.scale; const worldY = (originY - v.y) / v.scale; return { scale, x: originX - worldX * scale, y: originY - worldY * scale }; }
export function restoreViewport(key: string, fallback: BoardViewport): BoardViewport { const stored = loadCanvasViewport(key, { x: fallback.x, y: fallback.y, zoom: fallback.scale }); return { x: stored.x, y: stored.y, scale: stored.zoom }; }
