import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const tests = walk(join(root, 'src')).filter((file) => file.endsWith('.test.ts')).sort();
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...tests], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
