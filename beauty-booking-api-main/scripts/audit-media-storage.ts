import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { writeFile } from 'node:fs/promises';
import { inspectStorage } from '../src/media/storage-inventory';

async function main() {
  const [uploadRoot, prefix, output] = process.argv.slice(2);
  const url = process.env.DATABASE_URL, expected = process.env.QA_DATABASE;
  if (process.env.NODE_ENV !== 'test' || !url || !expected || new URL(url).pathname.slice(1) !== expected || !output) {
    throw new Error('Requires explicitly matching test DB and upload root/prefix/output. Dry-run only.');
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const rows = await db.mediaFile.findMany({ where: { storageKey: { startsWith: prefix + '/' } }, select: { storageKey: true } });
    const report = await inspectStorage(uploadRoot, prefix, new Set(rows.flatMap(row => row.storageKey ? [row.storageKey] : [])), new Date(Date.now() - 24 * 3600_000));
    await writeFile(output, JSON.stringify({ at: new Date().toISOString(), ...report }, null, 2));
    console.log(JSON.stringify({ mode: report.mode, scannedFiles: report.scannedFiles, orphanCandidates: report.orphanCandidates.length, missingReferenced: report.missingReferenced.length }));
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('Storage dry-run failed; no files or DB rows deleted'); process.exitCode = 1; });
