import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOutputIndex, outputsForNode } from './outputIndex.ts';
test('output index preserves stable arrays for the same run artifacts', () => {
    const raw = {
        first: { kind: 'table', node_id: 'a' },
        second: [
            { kind: 'plot', node_id: 'b' },
            { kind: 'metrics', node_id: 'a' },
        ],
    };
    const first = buildOutputIndex(raw);
    const second = buildOutputIndex(raw);
    assert.equal(first, second);
    assert.equal(first.all.length, 3);
    assert.equal(first.byNode.get('a')?.length, 2);
});
test('output index ignores malformed output entries', () => {
    const index = buildOutputIndex({
        missing: null,
        list: [{ kind: 'plot', node_id: 'node' }, null, 'bad'],
    });
    assert.equal(index.all.length, 1);
    assert.equal(index.byNode.get('node')?.length, 1);
});

test('a selected node without output does not receive another node’s output', () => {
    const run = {
        artifacts: {
            node_outputs: {
                extract: { kind: 'review_stage', node_id: 'extract', title: 'Extract Proposal Information' },
            },
        },
    };

    assert.deepEqual(outputsForNode(run as never, 'unrelated-node'), []);
    assert.equal(outputsForNode(run as never, null)[0]?.node_id, 'extract');
});
