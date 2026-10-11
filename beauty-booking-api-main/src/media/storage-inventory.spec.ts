import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectStorage } from './storage-inventory';

test('dry-run identifies only old unreferenced files inside explicit scope without deleting bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bb-inventory-'));
  try {
    await mkdir(join(root, 'qa')); await mkdir(join(root, 'outside'));
    for (const file of ['qa/referenced.png', 'qa/old-orphan.png', 'qa/fresh.png', 'outside/untouched.png']) await writeFile(join(root, file), file);
    await utimes(join(root, 'qa/old-orphan.png'), new Date(0), new Date(0));
    const result = await inspectStorage(root, 'qa', new Set(['qa/referenced.png', 'qa/missing.png']), new Date(Date.now() - 3600_000));
    expect(result.mode).toBe('DRY_RUN_ONLY');
    expect(result.orphanCandidates.map(file => file.storageKey)).toEqual(['qa/old-orphan.png']);
    expect(result.retainedUntracked).toEqual(['qa/fresh.png']);
    expect(result.missingReferenced).toEqual(['qa/missing.png']);
    expect(result.scannedFiles).toBe(3);
    expect(await readFile(join(root, 'qa/old-orphan.png'), 'utf8')).toBe('qa/old-orphan.png');
    expect(await readFile(join(root, 'outside/untouched.png'), 'utf8')).toBe('outside/untouched.png');
    await expect(inspectStorage(root, '../outside', new Set(), new Date())).rejects.toThrow();
    await expect(inspectStorage(root, '', new Set(), new Date())).rejects.toThrow();
  } finally { await rm(root, { recursive: true, force: true }); }
});
