import type { Edge, Node } from '@xyflow/react';
import type {
  ComponentDefinitionDraft,
  ComponentVersion,
  RegistryNode,
  UserProfile,
  WorkflowComponent,
} from '../../../../../../shared/_types';
import type { analyzeComponentBoundary } from '../../../../../_model/componentBoundary';
import type { FlowGraph } from '../../../../../_model/graph';

type ComponentBoundary = NonNullable<ReturnType<typeof analyzeComponentBoundary>>;

export function componentVersionFromSnapshot(
  snapshot: Record<string, unknown>,
  ownerUsername: UserProfile['username'],
): ComponentVersion {
  return {
    id: Number(snapshot.version_id || 0),
    component_id: Number(snapshot.component_id || 0),
    version_number: Number(snapshot.version_number || 0),
    semantic_version: String(snapshot.semantic_version || '1.0.0'),
    name: String(snapshot.component_name || 'Component'),
    description: '',
    graph: (snapshot.graph || {}) as Record<string, unknown>,
    graph_hash: String(snapshot.graph_hash || ''),
    interface_json: (snapshot.interface || { inputs: [], outputs: [] }) as ComponentVersion['interface_json'],
    exposed_parameters: (snapshot.exposed_parameters || []) as ComponentVersion['exposed_parameters'],
    dependencies_json: (snapshot.dependencies || []) as ComponentVersion['dependencies_json'],
    changelog: '',
    owner_username: ownerUsername,
    created_at: new Date().toISOString(),
  };
}

export function groupComponentGraph({
  nodes,
  edges,
  boundary,
  draft,
  componentNode,
}: {
  nodes: Node[];
  edges: Edge[];
  boundary: ComponentBoundary;
  draft: ComponentDefinitionDraft;
  componentNode: Node;
}) {
  const rewiredIncoming = boundary.incoming.map((edge, index) => ({
    ...edge,
    id: `component-in-${componentNode.id}-${index}`,
    target: componentNode.id,
    targetHandle: draft.inputs[index]?.id || `input_${index + 1}`,
    animated: true,
  }));
  const rewiredOutgoing = boundary.outgoing.map((edge, index) => ({
    ...edge,
    id: `component-out-${componentNode.id}-${index}`,
    source: componentNode.id,
    sourceHandle: draft.outputs[index]?.id || `output_${index + 1}`,
    animated: true,
  }));

  return {
    componentNode,
    nodes: [...nodes.filter((node) => !boundary.selected.has(node.id)), componentNode],
    edges: [
      ...edges.filter(
        (edge) => !boundary.selected.has(edge.source) && !boundary.selected.has(edge.target),
      ),
      ...rewiredIncoming,
      ...rewiredOutgoing,
    ],
  };
}

export function expandComponentGraph({
  nodes,
  edges,
  componentNode,
  nonce,
}: {
  nodes: Node[];
  edges: Edge[];
  componentNode: Node;
  nonce: string;
}) {
  const snapshot = componentNode.data?.componentSnapshot as Record<string, unknown> | undefined;
  if (!snapshot) return { ok: false as const, reason: 'missing_snapshot' as const };
  const graph = (snapshot.graph || {}) as FlowGraph;
  const sourceNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const sourceEdges = Array.isArray(graph.edges) ? graph.edges : [];
  if (sourceNodes.length === 0) return { ok: false as const, reason: 'empty_graph' as const };

  const idMap = new Map(
    sourceNodes.map((node) => [
      String(node.id),
      `${componentNode.id}__expanded__${nonce}__${node.id}`,
    ]),
  );
  const minX = Math.min(...sourceNodes.map((node) => Number(node.position?.x || 0)));
  const minY = Math.min(...sourceNodes.map((node) => Number(node.position?.y || 0)));
  const instanceParams = (componentNode.data?.params || {}) as Record<string, unknown>;
  const exposed = (snapshot.exposed_parameters || []) as ComponentVersion['exposed_parameters'];
  const expandedNodes = sourceNodes.map((sourceNode) => {
    const originalId = String(sourceNode.id);
    const data = { ...(sourceNode.data || {}) } as Record<string, unknown>;
    const params = { ...((data.params || {}) as Record<string, unknown>) };
    exposed.filter((item) => item.internal_node_id === originalId).forEach((item) => {
      params[item.internal_param] = Object.prototype.hasOwnProperty.call(instanceParams, item.id)
        ? instanceParams[item.id]
        : item.default;
    });
    data.params = params;
    return {
      ...sourceNode,
      id: idMap.get(originalId)!,
      selected: true,
      dragging: false,
      position: {
        x: componentNode.position.x + Number(sourceNode.position?.x || 0) - minX,
        y: componentNode.position.y + Number(sourceNode.position?.y || 0) - minY,
      },
      data,
    } as Node;
  });
  const expandedEdges = sourceEdges.map((sourceEdge, index) => ({
    ...sourceEdge,
    id: `${componentNode.id}__expanded-edge__${nonce}__${sourceEdge.id || index}`,
    source: idMap.get(String(sourceEdge.source))!,
    target: idMap.get(String(sourceEdge.target))!,
    selected: false,
    animated: true,
  })) as Edge[];

  const interfaceJson = (snapshot.interface || { inputs: [], outputs: [] }) as ComponentVersion['interface_json'];
  const inputById = new Map(interfaceJson.inputs.map((port) => [port.id, port]));
  const outputById = new Map(interfaceJson.outputs.map((port) => [port.id, port]));
  const outsideEdges = edges.filter(
    (edge) => edge.source !== componentNode.id && edge.target !== componentNode.id,
  );
  const incomingEdges = edges
    .filter((edge) => edge.target === componentNode.id)
    .flatMap((edge, index) => {
      const port = inputById.get(String(edge.targetHandle || ''));
      const target = port ? idMap.get(port.internal_node_id) : undefined;
      if (!port || !target) return [];
      return [{
        ...edge,
        id: `${edge.id}__expanded-in__${nonce}-${index}`,
        target,
        targetHandle: port.internal_handle,
        animated: true,
      }];
    });
  const outgoingEdges = edges
    .filter((edge) => edge.source === componentNode.id)
    .flatMap((edge, index) => {
      const port = outputById.get(String(edge.sourceHandle || ''));
      const source = port ? idMap.get(port.internal_node_id) : undefined;
      if (!port || !source) return [];
      return [{
        ...edge,
        id: `${edge.id}__expanded-out__${nonce}-${index}`,
        source,
        sourceHandle: port.internal_handle,
        animated: true,
      }];
    });

  const expandedIds = expandedNodes.map((node) => node.id);
  return {
    ok: true as const,
    expandedNodes,
    expandedIds,
    nodes: [
      ...nodes
        .filter((node) => node.id !== componentNode.id)
        .map((node) => ({ ...node, selected: false })),
      ...expandedNodes,
    ],
    edges: [...outsideEdges, ...expandedEdges, ...incomingEdges, ...outgoingEdges],
  };
}

export function upgradeComponentGraph({
  sourceNodeId,
  parentNodes,
  parentEdges,
  component,
  version,
  registryNode,
}: {
  sourceNodeId: string;
  parentNodes: Node[];
  parentEdges: Edge[];
  component: WorkflowComponent;
  version: ComponentVersion;
  registryNode: RegistryNode;
}) {
  const inputIds = new Set((registryNode.inputs || []).map((port) => port.id));
  const outputIds = new Set((registryNode.outputs || []).map((port) => port.id));
  const incompatible = parentEdges.some((edge) => (
    (edge.target === sourceNodeId && edge.targetHandle && !inputIds.has(String(edge.targetHandle)))
    || (edge.source === sourceNodeId && edge.sourceHandle && !outputIds.has(String(edge.sourceHandle)))
  ));
  if (incompatible) return { ok: false as const, reason: 'incompatible_ports' as const };

  const existing = parentNodes.find((node) => node.id === sourceNodeId);
  const defaults = Object.fromEntries(
    (registryNode.settingsSchema || []).map((item) => [item.name, item.default]),
  );
  const oldParams = (existing?.data?.params || {}) as Record<string, unknown>;
  const allowed = new Set((registryNode.settingsSchema || []).map((item) => item.name));
  const preserved = Object.fromEntries(
    Object.entries(oldParams).filter(([key]) => allowed.has(key)),
  );
  const replacementData = {
    ...(existing?.data || {}),
    registryId: registryNode.id,
    catalogId: registryNode.id,
    typeLabel: component.name,
    category: registryNode.category,
    description: registryNode.description,
    inputs: registryNode.inputs,
    outputs: registryNode.outputs,
    params: { ...defaults, ...preserved },
    componentSnapshot: registryNode.template?.componentSnapshot,
    componentId: component.id,
    componentVersionId: version.id,
    componentVersion: version.semantic_version,
  };

  return {
    ok: true as const,
    nodes: parentNodes.map((node) => (
      node.id === sourceNodeId ? { ...node, data: replacementData } : node
    )),
    edges: parentEdges,
  };
}
