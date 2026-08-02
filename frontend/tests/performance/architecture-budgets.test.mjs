import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = [
  '../../src/workspace/_components/ParamEditor.tsx',
  '../../src/workspace/_components/NodeModal.tsx',
  '../../src/workspace/pages/workflow/WorkflowPage.tsx',
  '../../src/workspace/pages/workflow/_features/components/_hooks/useComponentEditor.ts',
];

for (const relative of files) {
  test(`${relative} remains a bounded orchestrator`, async () => {
    const text = await readFile(new URL(relative, import.meta.url), 'utf8');
    assert.ok(text.split(/\r?\n/).length < 300);
  });
}
