import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('new Board cards persist output references instead of snapshots', async () => {
  const hook = await readFile(new URL('../../src/workspace/pages/workflow/_hooks/useAnalysisBoards.ts', import.meta.url), 'utf8');
  assert.match(hook, /outputRef:\s*createOutputReference/);
  assert.doesNotMatch(hook, /snapshot:\s*createOutputSnapshot\(output\)/);
});
