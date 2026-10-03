import type { Node } from '@xyflow/react';
import type { RegistryNode } from '../../shared/types';
import type { LegacyNodeAliases } from './catalog';

export type BoardSourceIdentity = {
    sourceLabel?: string;
    sourceTypeLabel?: string;
};

function text(value: unknown): string | undefined {
    const normalized = String(value || '').trim();
    return normalized || undefined;
}

function canonicalRegistryId(value: unknown, aliases: LegacyNodeAliases): string {
    let id = String(value || '');
    const visited = new Set<string>();
    while (aliases[id] && !visited.has(id)) {
        visited.add(id);
        id = String(aliases[id]);
    }
    return id;
}

/**
 * Board cards identify the workflow node that produced an output, not the
 * output itself. Prefer the catalog label for the node type so an old saved
 * `typeLabel` cannot be mistaken for a user-assigned workspace name.
 */
export function boardSourceIdentity(node: Node | undefined, registry: RegistryNode[], aliases: LegacyNodeAliases): BoardSourceIdentity {
    if (!node)
        return {};
    const registryId = canonicalRegistryId(node.data?.catalogId || node.data?.registryId, aliases);
    const definition = registry.find((candidate) => candidate.id === registryId);
    return {
        sourceLabel: text(node.data?.label) || node.id,
        sourceTypeLabel: text(definition?.label) || text(node.data?.typeLabel) || text(node.data?.registryId) || text(node.data?.catalogId),
    };
}
