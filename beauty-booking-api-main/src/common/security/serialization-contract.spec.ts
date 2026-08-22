import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : entry.endsWith('.ts') && !entry.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('response serialization security contract', () => {
  it('never expands the complete User record through a relation', () => {
    const violations: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), 'src'))) {
      const source = readFileSync(file, 'utf8');
      if (/\buser\s*:\s*true\b/.test(source)) {
        violations.push(file.split(/[\\/]/).pop()!);
      }
    }
    expect(violations).toEqual([]);
  });
});
