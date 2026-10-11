import { lstat, readdir } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';

/** Read-only inventory. Deliberately contains no unlink/delete operation. */
export async function inspectStorage(root: string, scopePrefix: string, knownKeys: ReadonlySet<string>, cutoff: Date) {
  if (!isAbsolute(root) || !scopePrefix || !Number.isFinite(cutoff.getTime()) ||
      scopePrefix.includes('\\') || scopePrefix.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Use an absolute storage root, bounded relative prefix and valid cutoff');
  }
  const base = resolve(root), scope = resolve(base, scopePrefix);
  if (!scope.startsWith(base + sep)) throw new Error('Scope outside storage root');
  // Do not follow a symlink anywhere along the scope boundary.
  let current = base;
  for (const part of ['', ...scopePrefix.split('/')]) {
    if (part) current = join(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Storage scope must contain real directories');
  }
  const present = new Set<string>();
  const orphanCandidates: Array<{ storageKey: string; bytes: number; modifiedAt: string }> = [];
  const retainedUntracked: string[] = [], skippedLinks: string[] = [];
  async function walk(directory: string, prefix: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const key = prefix + '/' + entry.name;
      const absolute = join(directory, entry.name);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) { skippedLinks.push(key); continue; }
      if (stat.isDirectory()) { await walk(absolute, key); continue; }
      if (!stat.isFile()) continue;
      present.add(key);
      if (!knownKeys.has(key)) {
        if (stat.mtime < cutoff) orphanCandidates.push({ storageKey: key, bytes: stat.size, modifiedAt: stat.mtime.toISOString() });
        else retainedUntracked.push(key);
      }
    }
  }
  await walk(scope, scopePrefix);
  return { mode: 'DRY_RUN_ONLY', scopePrefix, cutoff: cutoff.toISOString(), scannedFiles: present.size,
    orphanCandidates, retainedUntracked, skippedLinks,
    missingReferenced: [...knownKeys].filter(key => key.startsWith(scopePrefix + '/') && !present.has(key)) };
}
