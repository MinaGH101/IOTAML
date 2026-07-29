import type { Node, NodeChange } from '@xyflow/react';

function carriesDocumentChange(change: NodeChange) {
  return change.type === 'add'
    || change.type === 'remove'
    || change.type === 'replace';
}

export function hasDocumentNodeChange(changes: NodeChange[]) {
  return changes.some(carriesDocumentChange);
}

export function mergeCommittedPositions(committed: Node[], live: Node[]) {
  const liveById = new Map(live.map((node) => [node.id, node]));
  let changed = false;
  const next = committed.map((node) => {
    const current = liveById.get(node.id);
    if (
      !current
      || (
        current.position.x === node.position.x
        && current.position.y === node.position.y
      )
    ) return node;
    changed = true;
    return {
      ...node,
      position: current.position,
    };
  });
  return changed ? next : committed;
}
