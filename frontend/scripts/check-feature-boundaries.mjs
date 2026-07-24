import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

const frontendRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(frontendRoot, 'src');
const errors = [];

const requiredDirectories = [
  'app',
  'auth/pages/login/_components',
  'auth/_service',
  'projects/pages/create-project',
  'projects/pages/project-management',
  'projects/pages/project-detail',
  'projects/_components',
  'projects/_service',
  'workspace/pages/workflow/_components',
  'workspace/pages/workflow/_hooks',
  'workspace/pages/workflow/_model',
  'workspace/pages/workflow/_features/boards/_components',
  'workspace/pages/workflow/_features/boards/_hooks',
  'workspace/pages/workflow/_features/components/_components',
  'workspace/pages/workflow/_features/components/_hooks',
  'workspace/pages/workflow/_features/components/_model',
  'workspace/pages/board',
  'workspace/pages/board/_components',
  'workspace/pages/board/_hooks',
  'workspace/pages/board/_utils',
  'workspace/_components',
  'workspace/_hooks',
  'workspace/_model',
  'workspace/_service',
  'shared/_components',
  'shared/_service',
  'shared/_types',
  'shared/_utils',
];

const retiredPaths = [
  'api.ts',
  'components',
  'features',
  'nodes',
  'pages',
  'types',
  'utils',
];

for (const directory of requiredDirectories) {
  if (!existsSync(join(sourceRoot, directory))) {
    errors.push(`Missing required feature directory: src/${directory}`);
  }
}

for (const path of retiredPaths) {
  if (existsSync(join(sourceRoot, path))) {
    errors.push(`Legacy source path must not be restored: src/${path}`);
  }
}

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : ['.ts', '.tsx'].includes(extname(path)) ? [path] : [];
  });
}

function resolveImport(importer, specifier) {
  const base = resolve(dirname(importer), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  return candidates.find(existsSync);
}

function featureOf(path) {
  return relative(sourceRoot, path).split(sep)[0];
}

function isInside(path, fragment) {
  return relative(sourceRoot, path).split(sep).join('/').includes(fragment);
}

function sourcePath(path) {
  return relative(sourceRoot, path).split(sep).join('/');
}

const importPattern = /(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g;

for (const file of sourceFiles(sourceRoot)) {
  const contents = readFileSync(file, 'utf8');
  const owner = featureOf(file);
  const filePath = sourcePath(file);
  const lineCount = contents.split(/\r?\n/).length;
  let match;

  if (filePath.endsWith('Page.tsx') && lineCount > 500) {
    errors.push(`src/${filePath}: route pages must stay at or below 500 lines (found ${lineCount})`);
  }

  if (
    filePath.startsWith('workspace/pages/workflow/')
    && filePath.includes('/_hooks/')
    && lineCount > 450
  ) {
    errors.push(`src/${filePath}: workflow hooks must stay at or below 450 lines (found ${lineCount})`);
  }

  while ((match = importPattern.exec(contents)) !== null) {
    const target = resolveImport(file, match[1]);
    const sourceName = relative(frontendRoot, file).split(sep).join('/');

    if (!target) {
      errors.push(`${sourceName}: unresolved import "${match[1]}"`);
      continue;
    }

    if (!target.startsWith(sourceRoot + sep)) continue;

    const dependency = featureOf(target);

    if (owner === 'shared' && ['auth', 'projects', 'workspace'].includes(dependency)) {
      errors.push(`${sourceName}: shared code cannot depend on ${dependency}`);
    }

    if (owner === 'auth' && ['projects', 'workspace'].includes(dependency)) {
      errors.push(`${sourceName}: auth cannot depend on ${dependency}`);
    }

    if (owner === 'projects' && dependency === 'workspace' && !isInside(target, 'workspace/_service/')) {
      errors.push(`${sourceName}: projects may only consume the workspace service boundary`);
    }

    if (owner === 'workspace' && dependency === 'projects' && !isInside(target, 'projects/_service/')) {
      errors.push(`${sourceName}: workspace may only consume the projects service boundary`);
    }

    if (
      sourcePath(file).startsWith('workspace/_model/')
      && ['workspace/_components/', 'workspace/_hooks/', 'workspace/_service/', 'workspace/pages/']
        .some((fragment) => sourcePath(target).startsWith(fragment))
    ) {
      errors.push(`${sourceName}: workspace model code cannot depend on UI, hooks, services, or pages`);
    }

    if (
      sourcePath(file).includes('/_service/')
      && ['/_components/', '/_hooks/', '/_model/', '/pages/']
        .some((fragment) => sourcePath(target).includes(fragment))
    ) {
      errors.push(`${sourceName}: service code cannot depend on feature implementation layers`);
    }

    if (
      filePath.startsWith('workspace/pages/workflow/')
      && filePath.includes('/_model/')
      && ['/_components/', '/_hooks/', '/_service/']
        .some((fragment) => sourcePath(target).includes(fragment))
    ) {
      errors.push(`${sourceName}: workflow model code cannot depend on UI, hooks, or services`);
    }
  }
}

if (errors.length) {
  console.error('Frontend architecture check failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Frontend feature boundaries are valid.');
