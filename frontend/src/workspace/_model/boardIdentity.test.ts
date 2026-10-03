import assert from 'node:assert/strict';
import test from 'node:test';
import type { Node } from '@xyflow/react';
import type { RegistryNode } from '../../shared/types';
import { boardSourceIdentity } from './boardIdentity.ts';

const registry = [{
    id: 'VZ-003', label: 'P-P Plot', category: 'Visualizations', description: '', inputs: [], outputs: [],
    settingsSchema: [], params: [], executionMode: 'instant', supportsDynamicParameters: false, implemented: true,
}] as RegistryNode[];

test('board source identity keeps the workspace name separate from the catalog node type', () => {
    const node = {
        id: 'node-9', position: { x: 0, y: 0 },
        data: { label: 'Normalized PP', typeLabel: 'Old saved type', registryId: 'VZ-003' },
    } as Node;
    assert.deepEqual(boardSourceIdentity(node, registry, {}), {
        sourceLabel: 'Normalized PP',
        sourceTypeLabel: 'P-P Plot',
    });
});

test('board source identity resolves a legacy registry alias before choosing the node type', () => {
    const node = {
        id: 'node-9', position: { x: 0, y: 0 },
        data: { label: 'My normalizer', registryId: 'legacy-pp' },
    } as Node;
    assert.equal(boardSourceIdentity(node, registry, { 'legacy-pp': 'VZ-003' }).sourceTypeLabel, 'P-P Plot');
});
