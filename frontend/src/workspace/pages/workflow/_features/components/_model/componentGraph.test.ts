import assert from 'node:assert/strict';
import test from 'node:test';
import type { Edge, Node } from '@xyflow/react';
import type { ComponentVersion, RegistryNode, WorkflowComponent } from '../../../../../../shared/_types';
import { expandComponentGraph, upgradeComponentGraph } from './componentGraph.ts';

const componentNode = {
  id: 'component',
  position: { x: 100, y: 200 },
  data: {
    params: { threshold: 3 },
    componentSnapshot: {
      graph: {
        nodes: [
          { id: 'inner-a', position: { x: 0, y: 0 }, data: { params: {} } },
          { id: 'inner-b', position: { x: 150, y: 0 }, data: { params: {} } },
        ],
        edges: [{ id: 'inner-edge', source: 'inner-a', target: 'inner-b' }],
      },
      interface: {
        inputs: [{
          id: 'input',
          internal_node_id: 'inner-a',
          internal_handle: 'input',
        }],
        outputs: [{
          id: 'output',
          internal_node_id: 'inner-b',
          internal_handle: 'output',
        }],
      },
      exposed_parameters: [{
        id: 'threshold',
        internal_node_id: 'inner-a',
        internal_param: 'value',
        default: 1,
      }],
    },
  },
} as unknown as Node;

test('component expansion restores internal nodes and reconnects external edges', () => {
  const outside = { id: 'outside', position: { x: 0, y: 0 }, data: {} } as Node;
  const consumer = { id: 'consumer', position: { x: 0, y: 0 }, data: {} } as Node;
  const edges = [
    { id: 'incoming', source: 'outside', target: 'component', targetHandle: 'input' },
    { id: 'outgoing', source: 'component', target: 'consumer', sourceHandle: 'output' },
  ] as Edge[];
  const expanded = expandComponentGraph({
    nodes: [outside, componentNode, consumer],
    edges,
    componentNode,
    nonce: 'test',
  });
  assert.equal(expanded.ok, true);
  if (!expanded.ok) return;
  assert.equal(expanded.expandedNodes.length, 2);
  assert.equal(expanded.nodes.some((node) => node.id === 'component'), false);
  assert.equal(expanded.edges.some((edge) => edge.source === 'outside' && edge.target.includes('inner-a')), true);
  assert.equal(expanded.edges.some((edge) => edge.target === 'consumer' && edge.source.includes('inner-b')), true);
  assert.equal(
    (expanded.expandedNodes[0].data.params as Record<string, unknown>).value,
    3,
  );
});

test('component upgrade rejects a version that removes connected ports', () => {
  const component = { id: 1, name: 'Component' } as WorkflowComponent;
  const version = { id: 2, semantic_version: '2.0.0' } as ComponentVersion;
  const registryNode = {
    id: 'component-1',
    inputs: [],
    outputs: [],
    settingsSchema: [],
  } as unknown as RegistryNode;
  const result = upgradeComponentGraph({
    sourceNodeId: 'component',
    parentNodes: [componentNode],
    parentEdges: [{
      id: 'incoming',
      source: 'outside',
      target: 'component',
      targetHandle: 'removed-input',
    }] as Edge[],
    component,
    version,
    registryNode,
  });
  assert.deepEqual(result, { ok: false, reason: 'incompatible_ports' });
});
