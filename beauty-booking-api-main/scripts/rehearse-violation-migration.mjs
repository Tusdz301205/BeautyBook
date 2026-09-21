import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import pg from 'pg';

const name = process.env.BEAUTYBOOK_TEST_DATABASE;
assert.match(name ?? '', /^beautybook_test_[a-z0-9_]+$/i);
assert.notEqual(process.env.NODE_ENV, 'production');
const url = new URL(process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
url.pathname = `/${name}`;
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
try {
  const tables = (await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename`)).rows.map(row => row.tablename);
  assert.ok(tables.every(table => /^[a-z0-9_]+$/.test(table)));
  async function fingerprint() {
    const result = {};
    for (const table of tables) {
      result[table] = (await db.query(`SELECT count(*)::int AS count, md5(coalesce(string_agg(row::text,',' ORDER BY row::text),'')) AS hash FROM (SELECT to_jsonb(t) AS row FROM "${table}" t) s`)).rows[0];
    }
    return result;
  }
  const before = await fingerprint();
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
      cwd: process.cwd(), windowsHide: true, env: { ...process.env, DATABASE_URL: url.toString() }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(output.replaceAll(url.toString(), '[TEST_DATABASE]'))));
  });
  assert.deepEqual(await fingerprint(), before, 'Existing table data changed during additive migration');
  console.log(JSON.stringify({ testDatabase: name, preservedTables: tables.length, preservedBookings: before.bookings.count,
    newEventCount: (await db.query('SELECT count(*)::int AS count FROM booking_violation_events')).rows[0].count, result: 'PASS' }));
} finally { await db.end(); }
