import test from 'node:test';
import assert from 'node:assert/strict';
import type { Edge, Node } from '@xyflow/react';
import { workflowNodeOrder } from './workflowNodeOrder.ts';

const node = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: {} });
const edge = (id: string, source: string, target: string): Edge => ({ id, source, target });

test('modal navigation follows workflow edges instead of persisted node array order', () => {
    const nodes = ['intake', 'extract', 'form', 'ocr'].map(node);
    const edges = [
        edge('e1', 'intake', 'ocr'),
        edge('e2', 'ocr', 'extract'),
        edge('e3', 'extract', 'form'),
    ];
    assert.deepEqual(workflowNodeOrder(nodes, edges).map((item) => item.id), ['intake', 'ocr', 'extract', 'form']);
});
