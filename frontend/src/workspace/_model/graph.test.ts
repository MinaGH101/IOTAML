import test from 'node:test';
import assert from 'node:assert/strict';
import type { Edge, Node } from '@xyflow/react';
import { connectedGraph } from './executionGraph.ts';
function node(id: string): Node {
    return { id, position: { x: 0, y: 0 }, data: {} };
}
function edge(id: string, source: string, target: string): Edge {
    return { id, source, target };
}
test('selected-node execution includes only the node and its upstream dependencies', () => {
    const result = connectedGraph(['input', 'clean', 'selected', 'downstream', 'sibling'].map(node), [
        edge('e1', 'input', 'clean'),
        edge('e2', 'clean', 'selected'),
        edge('e3', 'selected', 'downstream'),
        edge('e4', 'clean', 'sibling'),
    ], 'selected');
    assert.equal(result.mode, 'selected');
    assert.deepEqual(result.nodes.map((item) => item.id), ['input', 'clean', 'selected']);
    assert.deepEqual(result.edges.map((item) => item.id), ['e1', 'e2']);
});
test('run with no selection keeps the complete workflow', () => {
    const nodes = ['input', 'output'].map(node);
    const edges = [edge('e1', 'input', 'output')];
    const result = connectedGraph(nodes, edges, null);
    assert.equal(result.mode, 'all');
    assert.equal(result.nodes, nodes);
    assert.equal(result.edges, edges);
});
