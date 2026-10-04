import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = join(root, 'src');
const all = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.[jt]sx?$/.test(entry.name)) all.push(path);
  }
}
walk(sourceRoot);

const visited = new Set();
const queue = [join(root, 'App.tsx'), join(root, 'index.ts')];
while (queue.length) {
  const path = queue.pop();
  if (!path || visited.has(path) || !existsSync(path)) continue;
  visited.add(path);
  const source = readFileSync(path, 'utf8');
  const imports = ts.preProcessFile(source, true, true).importedFiles.map((item) => item.fileName);
  for (const [, specifier] of source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) imports.push(specifier);
  for (const specifier of imports) {
    if (!specifier.startsWith('.')) continue;
    const base = resolve(dirname(path), specifier);
    const candidates = extname(base)
      ? [base]
      : [base + '.ts', base + '.tsx', base + '.web.tsx', base + '.native.tsx', base + '.js', base + '.jsx', join(base, 'index.ts'), join(base, 'index.tsx')];
    for (const candidate of candidates) if (existsSync(candidate)) queue.push(candidate);
  }
}

const unused = all.filter((path) => !visited.has(path)).map((path) => path.slice(root.length + 1).replaceAll('\\', '/'));
console.log(JSON.stringify({ sourceFiles: all.length, reachable: all.length - unused.length, unused }, null, 2));
