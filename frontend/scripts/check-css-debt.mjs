import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const root = process.cwd();
const entry = path.join(root, 'src', 'styles.css');
const entryCss = fs.readFileSync(entry, 'utf8');
const files = [];
const importPattern = /@import\s+["'](.+?)["'];/g;
let match;
while ((match = importPattern.exec(entryCss)) !== null) {
  files.push(path.resolve(path.dirname(entry), match[1]));
}
const cubes = path.join(root, 'src', 'components', 'Cubes.css');
if (fs.existsSync(cubes)) files.push(cubes);

const MAX_IMPORTANT = 2273;
let importantCount = 0;
let duplicateExactDeclarations = 0;
const seen = new Set();

function scopeKey(decl) {
  const ancestors = [];
  let current = decl.parent;
  while (current) {
    if (current.type === 'atrule') ancestors.push(`@${current.name} ${current.params}`.trim());
    current = current.parent;
  }
  return ancestors.reverse().join(' > ');
}

for (const file of files) {
  const css = fs.readFileSync(file, 'utf8');
  importantCount += (css.match(/!important/g) || []).length;
  const rootNode = postcss.parse(css, { from: file });
  rootNode.walkDecls((decl) => {
    const rule = decl.parent;
    if (!rule || rule.type !== 'rule') return;
    const key = [scopeKey(decl), rule.selector, decl.prop, decl.important ? 'important' : 'normal', decl.value].join('\u0000');
    if (seen.has(key)) duplicateExactDeclarations += 1;
    seen.add(key);
  });
}

const failures = [];
if (importantCount > MAX_IMPORTANT) failures.push(`!important count increased: ${importantCount} > ${MAX_IMPORTANT}`);
if (duplicateExactDeclarations > 0) failures.push(`Found ${duplicateExactDeclarations} exact duplicate declarations. Run npm run css:dedupe.`);

console.log(JSON.stringify({ files: files.length, importantCount, maxImportant: MAX_IMPORTANT, duplicateExactDeclarations }, null, 2));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
