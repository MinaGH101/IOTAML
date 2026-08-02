import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = join(root, 'src');
const failures = [];

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

for (const file of walk(src).filter((path) => ['.ts', '.tsx'].includes(extname(path)))) {
  const text = readFileSync(file, 'utf8');
  const name = relative(root, file).replaceAll('\\', '/');
  const lines = text.split(/\r?\n/).length;

  if (/\bfetch\s*\(/.test(text) && name !== 'src/shared/api/httpClient.ts') {
    failures.push(`${name}: direct fetch() is only allowed in shared/api/httpClient.ts`);
  }
  if (/localStorage/.test(text) && ![
    'src/shared/auth/tokenStorage.ts',
    'src/app/bootstrap/themeBootstrap.ts',
    'src/workspace/_model/viewportStorage.ts',
  ].includes(name)) {
    failures.push(`${name}: localStorage access must use a persistence adapter`);
  }
  if (name.endsWith('WorkflowPage.tsx') && lines > 80) failures.push(`${name}: composition page exceeds 80 lines`);
  if (name.endsWith('/ParamEditor.tsx') && lines > 260) failures.push(`${name}: parameter orchestrator exceeds 260 lines`);
  if (name.endsWith('/NodeModal.tsx') && lines > 180) failures.push(`${name}: node dialog orchestrator exceeds 180 lines`);
  if (/(@ts-ignore|@ts-nocheck|\bas any\b)/.test(text)) failures.push(`${name}: unsafe TypeScript suppression found`);
  if (/\bTODO\b|the rest remains unchanged|copy existing logic/i.test(text)) failures.push(`${name}: placeholder implementation marker found`);
}

if (failures.length) {
  console.error('Source lint failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Source lint passed.');
