import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('workflow UI renders persistent per-node state instead of only the latest run', async () => {
  const editor = await readFile(new URL('../../src/workspace/pages/workflow/WorkflowEditor.tsx', import.meta.url), 'utf8');
  const overlays = await readFile(new URL('../../src/workspace/pages/workflow/_components/WorkflowOverlays.tsx', import.meta.url), 'utf8');
  const stage = await readFile(new URL('../../src/workspace/pages/workflow/_components/WorkflowStage.tsx', import.meta.url), 'utf8');

  assert.match(editor, /normalizeOutputs\(displayRun, null\)/);
  assert.match(editor, /currentRun:\s*displayRun/);
  assert.match(overlays, /run=\{runs\.displayRun\}/);
  assert.match(stage, /run=\{runs\.displayRun\}/);
  assert.match(stage, /resultRun=\{runs\.displayRun\}/);
});
