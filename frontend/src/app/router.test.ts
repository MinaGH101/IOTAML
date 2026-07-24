import assert from 'node:assert/strict';
import test from 'node:test';
import { appRoutePath, parseAppRoute } from './routes.ts';

test('parses project and workflow routes with stable identifiers', () => {
  assert.deepEqual(parseAppRoute('/projects/42'), { name: 'project', projectId: 42 });
  assert.deepEqual(
    parseAppRoute('/projects/42/workspace', '?workflow=7'),
    { name: 'workflow', projectId: 42, workflowId: 7 },
  );
  assert.deepEqual(parseAppRoute('/projects/nope'), { name: 'not-found' });
});

test('builds canonical application paths', () => {
  assert.equal(appRoutePath({ name: 'projects' }), '/projects');
  assert.equal(appRoutePath({ name: 'project', projectId: 8 }), '/projects/8');
  assert.equal(
    appRoutePath({ name: 'workflow', projectId: 8, workflowId: 13 }),
    '/projects/8/workspace?workflow=13',
  );
});
