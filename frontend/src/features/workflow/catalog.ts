import type { Node } from '@xyflow/react';
import type { RegistryNode } from '../../types';

export type LegacyNodeAliases = Record<string, string>;
export type PortCompatibilityMap = Record<string, string[]>;

export const EMPTY_ALIASES: LegacyNodeAliases = {};
export const EMPTY_PORT_COMPATIBILITY: PortCompatibilityMap = {};

export function resolveRegistryId(id: unknown, aliases: LegacyNodeAliases): string {
  const value = String(id || '');
  return aliases[value] || value;
}

export function registryForFlowNode(
  node: Node | undefined,
  registry: RegistryNode[],
  aliases: LegacyNodeAliases,
): RegistryNode | null {
  if (!node) return null;
  const registryId = String(node.data?.catalogId || node.data?.registryId || '');
  const canonicalId = resolveRegistryId(registryId, aliases);
  return registry.find((item) => item.id === canonicalId) || null;
}

export function portTypeFor(
  node: Node | undefined,
  registry: RegistryNode[],
  aliases: LegacyNodeAliases,
  handle: string | null | undefined,
  side: 'source' | 'target',
): string {
  const definition = registryForFlowNode(node, registry, aliases);
  const ports = side === 'source' ? definition?.outputs : definition?.inputs;
  if (!ports?.length) return 'any';
  const port = handle ? ports.find((item) => item.id === handle) : ports[0];
  return String((port || ports[0]).type || 'any');
}

export function compatiblePorts(
  sourceType: string,
  targetType: string,
  compatibility: PortCompatibilityMap,
): boolean {
  if (sourceType === targetType || sourceType === 'any' || targetType === 'any') return true;
  return (compatibility[sourceType] || []).includes(targetType);
}
