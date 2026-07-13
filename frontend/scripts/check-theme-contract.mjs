import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const themeFile = path.join(srcRoot, 'styles', 'theme.css');
const supportedExtensions = new Set(['.css', '.ts', '.tsx', '.js', '.jsx']);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(resolved) : [resolved];
  });
}

const sourceFiles = walk(srcRoot).filter((file) => supportedExtensions.has(path.extname(file)));
const cssFiles = sourceFiles.filter((file) => file.endsWith('.css'));
const componentCssFiles = cssFiles.filter((file) => file !== themeFile);
const themeCss = fs.readFileSync(themeFile, 'utf8');

const definedVariables = new Set(
  [...themeCss.matchAll(/(^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/gm)].map((match) => match[2])
);

const runtimeVariables = new Set([
  '--project-color',
  '--swatch',
  '--output-width',
  '--settings-width',
  '--input-width',
  '--output-fr',
  '--settings-fr',
  '--input-fr',
]);

const legacyExact = new Set([
  '--bg', '--shell', '--panel', '--panel-solid', '--panel-soft', '--panel-strong',
  '--input', '--input-bg', '--board', '--workspace-back', '--text', '--soft',
  '--muted', '--line', '--line-strong', '--primary', '--success', '--danger',
  '--shadow', '--shadow-none', '--border-width', '--border-width-strong',
  '--radius-none', '--radius-compact', '--radius-control', '--radius-panel',
  '--radius-modal', '--radius-pill', '--radius-round', '--radius-brand',
  '--color-transparent', '--color-absolute-white', '--color-absolute-black',
  '--cat-color', '--cat-color-soft',
]);

const legacyPrefixes = [
  '--tone-',
  '--radius-ref-',
  '--iota-',
  '--minimal-',
  '--workflow-shell-',
  '--results-',
  '--n8n-modal-',
  '--ai-',
];

const failures = [];
const stats = {
  sourceFiles: sourceFiles.length,
  cssFiles: cssFiles.length,
  themeVariables: definedVariables.size,
  rawColorLiteralsOutsideTheme: 0,
  customPropertiesOutsideTheme: 0,
  rawBorderRadiiOutsideTheme: 0,
  activeShadowsOutsideTheme: 0,
  activeBackdropFiltersOutsideTheme: 0,
  undefinedVariableReferences: 0,
  legacyVariableReferences: 0,
};

for (const file of componentCssFiles) {
  const css = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);

  const customProperties = [...css.matchAll(/^\s*--[A-Za-z0-9_-]+\s*:/gm)];
  stats.customPropertiesOutsideTheme += customProperties.length;
  if (customProperties.length) failures.push(`${relative}: ${customProperties.length} custom property declaration(s)`);

  const rawRadii = [...css.matchAll(/border-radius\s*:\s*([^;\n}]+)/g)]
    .filter((item) => !/^(?:var\(|inherit$|initial$|unset$|revert$)/i.test(item[1].trim()));
  stats.rawBorderRadiiOutsideTheme += rawRadii.length;
  if (rawRadii.length) failures.push(`${relative}: ${rawRadii.length} raw border-radius value(s)`);

  const activeShadows = [...css.matchAll(/(?:box-shadow|text-shadow)\s*:\s*([^;\n}]+)/g)]
    .filter((item) => item[1].replace(/!important/gi, '').trim() !== 'none');
  stats.activeShadowsOutsideTheme += activeShadows.length;
  if (activeShadows.length) failures.push(`${relative}: ${activeShadows.length} active shadow(s)`);

  const activeBlur = [...css.matchAll(/(?:-webkit-)?backdrop-filter\s*:\s*([^;\n}]+)/g)]
    .filter((item) => item[1].replace(/!important/gi, '').trim().toLowerCase() !== 'none');
  stats.activeBackdropFiltersOutsideTheme += activeBlur.length;
  if (activeBlur.length) failures.push(`${relative}: ${activeBlur.length} active backdrop filter(s)`);
}

for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);

  if (file !== themeFile) {
    const rawColors = [...content.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g)];
    stats.rawColorLiteralsOutsideTheme += rawColors.length;
    if (rawColors.length) failures.push(`${relative}: ${rawColors.length} raw color literal(s)`);
  }

  const seenUndefined = new Set();
  const seenLegacy = new Set();

  for (const match of content.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) {
    const variable = match[1];

    if (!definedVariables.has(variable) && !runtimeVariables.has(variable)) {
      seenUndefined.add(variable);
    }

    if (legacyExact.has(variable) || legacyPrefixes.some((prefix) => variable.startsWith(prefix))) {
      seenLegacy.add(variable);
    }
  }

  if (seenUndefined.size) {
    stats.undefinedVariableReferences += seenUndefined.size;
    failures.push(`${relative}: undefined variable reference(s): ${[...seenUndefined].sort().join(', ')}`);
  }

  if (seenLegacy.size) {
    stats.legacyVariableReferences += seenLegacy.size;
    failures.push(`${relative}: legacy variable reference(s): ${[...seenLegacy].sort().join(', ')}`);
  }
}

console.log(JSON.stringify(stats, null, 2));

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
