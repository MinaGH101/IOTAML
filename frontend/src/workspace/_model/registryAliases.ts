export type LegacyNodeAliases = Record<string, string>;

export function resolveRegistryId(id: unknown, aliases: LegacyNodeAliases): string {
  let value = String(id || '');
  const visited = new Set<string>();
  while (aliases[value] && !visited.has(value)) {
    visited.add(value);
    value = String(aliases[value]);
  }
  return value;
}
