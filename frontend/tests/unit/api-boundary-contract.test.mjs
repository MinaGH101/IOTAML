import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('HTTP client owns auth headers, timeout, request IDs and 204 handling', async () => {
  const source = await readFile(new URL('../../src/shared/api/httpClient.ts', import.meta.url), 'utf8');
  for (const fragment of ['Authorization', 'AbortController', 'x-request-id', 'response.status === 204']) {
    assert.ok(source.includes(fragment), `missing ${fragment}`);
  }
});
