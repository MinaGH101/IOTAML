import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const nginx = await readFile(new URL('../../nginx.conf', import.meta.url), 'utf8');

test('production server keeps SPA fallback and API proxy', () => {
  assert.match(nginx, /try_files\s+\$uri\s+\$uri\/\s+\/index\.html/);
  assert.match(nginx, /location \/api\//);
  assert.match(nginx, /proxy_pass\s+http:\/\/\$\{API_UPSTREAM\}/);
});

test('SSE compatibility disables proxy buffering', () => {
  assert.match(nginx, /proxy_buffering\s+off/);
});
