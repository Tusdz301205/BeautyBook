import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const name = process.env.BEAUTYBOOK_TEST_DATABASE;
assert.match(name ?? '', /^beautybook_test_[a-z0-9_]+$/i);
assert.notEqual(process.env.NODE_ENV, 'production');
const url = new URL(process.env.DATABASE_URL);
url.pathname = `/${name}`;
const pool = new pg.Pool({ connectionString: url.toString() });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
try {
  const booking = await db.booking.findFirstOrThrow({ where: { bookingCode: { startsWith: 'TEST-CANCEL-' } }, select: { id: true } });
  let locked, snapshotted, committed;
  const lockReady = new Promise(resolve => { locked = resolve; });
  const snapshotReady = new Promise(resolve => { snapshotted = resolve; });
  const commitReady = new Promise(resolve => { committed = resolve; });
  const first = db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${booking.id} FOR UPDATE`;
    locked(); await snapshotReady;
    await tx.booking.update({ where: { id: booking.id }, data: { updatedAt: new Date() } });
  }, { isolationLevel: 'Serializable' }).then(() => committed());
  const second = db.$transaction(async tx => {
    await lockReady;
    await tx.booking.findUnique({ where: { id: booking.id }, select: { id: true } });
    snapshotted(); await commitReady;
    await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${booking.id} FOR UPDATE`;
  }, { isolationLevel: 'Serializable' });
  const outcomes = await Promise.allSettled([first, second]);
  for (const outcome of outcomes) {
    if (outcome.status === 'rejected') {
      const error = outcome.reason;
      // No SQL, row values, URLs or credentials are emitted.
      console.log(JSON.stringify({ code: error.code, sqlState: error.meta?.code,
        adapterName: error.meta?.driverAdapterError?.name,
        adapterCause: error.meta?.driverAdapterError?.cause?.kind,
        adapterCode: error.meta?.driverAdapterError?.cause?.originalCode }));
    }
  }
} finally { await db.$disconnect(); await pool.end(); }
