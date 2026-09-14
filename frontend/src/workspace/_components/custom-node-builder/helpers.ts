import type { Node } from '@xyflow/react';
import type { PortDefinition } from '../../../shared/types';
export const PORT_TYPES = ['any', 'dataframe', 'json', 'json_items', 'series', 'columns', 'model', 'metrics', 'plot', 'file', 'report', 'artifact', 'artifact_ref', 'text', 'schema', 'trigger', 'stream'];
export function uniquePortId(base: string, ports: PortDefinition[]) { const normalized = (base || 'input').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^([^A-Za-z])/, 'p_$1') || 'input'; if (!ports.some((p) => p.id === normalized))
    return normalized; let i = 2; while (ports.some((p) => p.id === `${normalized}_${i}`))
    i += 1; return `${normalized}_${i}`; }
export function emptyPort(kind: 'input' | 'output', ports: PortDefinition[]): PortDefinition { const id = uniquePortId(kind, ports); return { id, name: kind === 'input' ? 'Input' : 'Output', type: kind === 'input' ? 'any' : 'json', required: kind === 'input', multiple: false }; }
function parseCsvLine(line: string) { const cells: string[] = []; let current = ''; let quoted = false; for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
        if (quoted && line[i + 1] === '"') {
            current += '"';
            i += 1;
        }
        else
            quoted = !quoted;
    }
    else if (char === ',' && !quoted) {
        cells.push(current.trim());
        current = '';
    }
    else
        current += char;
} cells.push(current.trim()); return cells; }
export async function readTemplate(file: File): Promise<Record<string, unknown>> { if (file.size > 512 * 1024)
    throw new Error('Template must be smaller than 512 KB.'); const text = await file.text(); if (/\.json$/i.test(file.name) || file.type.includes('json'))
    return { format: 'json', filename: file.name, data: JSON.parse(text) }; const all = text.split(/\r?\n/); const lines = all.filter((line) => line.trim()).slice(0, 201); if (!lines.length)
    return { format: 'csv', filename: file.name, columns: [], data: [] }; const columns = parseCsvLine(lines[0]); const data = lines.slice(1).map((line) => { const cells = parseCsvLine(line); return Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? ''])); }); return { format: 'csv', filename: file.name, columns, data, truncated: all.length > 201 }; }
export const registryId = (node: Node) => String(node.data?.catalogId || node.data?.registryId || '');
