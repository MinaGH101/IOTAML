import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const root = process.cwd();
const styleEntry = path.join(root, 'src', 'styles.css');
const entryCss = fs.readFileSync(styleEntry, 'utf8');
const importPattern = /@import\s+["'](.+?)["'];/g;
const orderedFiles = [];
let match;
while ((match = importPattern.exec(entryCss)) !== null) {
  orderedFiles.push(path.resolve(path.dirname(styleEntry), match[1]));
}

const standaloneFiles = [path.join(root, 'src', 'components', 'Cubes.css')]
  .filter((file) => fs.existsSync(file));

function scopeKey(decl) {
  const ancestors = [];
  let current = decl.parent;
  while (current) {
    if (current.type === 'atrule') ancestors.push(`@${current.name} ${current.params}`.trim());
    current = current.parent;
  }
  return ancestors.reverse().join(' > ');
}

function processGroup(files) {
  const roots = files.map((file) => ({ file, root: postcss.parse(fs.readFileSync(file, 'utf8'), { from: file }) }));
  const lastByKey = new Map();
  let declarationsBefore = 0;

  for (const { root } of roots) {
    root.walkDecls((decl) => {
      declarationsBefore += 1;
      const rule = decl.parent;
      if (!rule || rule.type !== 'rule') return;
      const key = [
        scopeKey(decl),
        rule.selector,
        decl.prop,
        decl.important ? 'important' : 'normal',
        decl.value,
      ].join('\u0000');
      lastByKey.set(key, decl);
    });
  }

  let removed = 0;
  for (const { root } of roots) {
    root.walkDecls((decl) => {
      const rule = decl.parent;
      if (!rule || rule.type !== 'rule') return;
      const key = [
        scopeKey(decl),
        rule.selector,
        decl.prop,
        decl.important ? 'important' : 'normal',
        decl.value,
      ].join('\u0000');
      if (lastByKey.get(key) !== decl) {
        decl.remove();
        removed += 1;
      }
    });

    root.walkRules((rule) => {
      if (!rule.nodes || rule.nodes.every((node) => node.type === 'comment')) rule.remove();
    });

    fs.writeFileSync(root.source.input.file, root.toString());
  }

  return { declarationsBefore, removed, declarationsAfter: declarationsBefore - removed };
}

const importedResult = processGroup(orderedFiles);
const standaloneResults = standaloneFiles.map((file) => processGroup([file]));
const standalone = standaloneResults.reduce(
  (total, current) => ({
    declarationsBefore: total.declarationsBefore + current.declarationsBefore,
    removed: total.removed + current.removed,
    declarationsAfter: total.declarationsAfter + current.declarationsAfter,
  }),
  { declarationsBefore: 0, removed: 0, declarationsAfter: 0 },
);

const result = {
  files: orderedFiles.length + standaloneFiles.length,
  declarationsBefore: importedResult.declarationsBefore + standalone.declarationsBefore,
  removed: importedResult.removed + standalone.removed,
  declarationsAfter: importedResult.declarationsAfter + standalone.declarationsAfter,
};

console.log(JSON.stringify(result, null, 2));
