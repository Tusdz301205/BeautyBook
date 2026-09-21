/** Deploy the reviewed Manager retirement only after a successful local restore
 * rehearsal. Default mode is read-only; --apply explicitly enables migrations.
 * No resets, seeds, row repairs, database drops, or credentials in output.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backupRoot = resolve(backend, '../docs/db-backups');
const manifestArg = process.argv.indexOf('--rehearsal');
if (manifestArg < 0 || !process.argv[manifestArg + 1]) throw new Error('Supply --rehearsal <successful manifest>');
const manifestPath = resolve(backend, process.argv[manifestArg + 1]);
if (!manifestPath.startsWith(backupRoot + sep)) throw new Error('Rehearsal manifest must be in local ignored db-backups');
const rehearsal = JSON.parse(await readFile(manifestPath, 'utf8'));
if (rehearsal.state !== 'PASSED' || !/^beautybook_test_manager_\d+$/.test(rehearsal.testDatabase)) {
  throw new Error('A successful isolated restore rehearsal is required');
}
const sourceUrl = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(sourceUrl.hostname)
  || decodeURIComponent(sourceUrl.pathname.slice(1)) !== rehearsal.sourceDatabase
  || /test|e2e/i.test(rehearsal.sourceDatabase)) throw new Error('Unexpected deployment target');
const dumpPath = resolve(rehearsal.dumpPath);
if (!dumpPath.startsWith(backupRoot + sep)) throw new Error('Unexpected backup location');
const dump = await stat(dumpPath);
if (!dump.isFile() || dump.size === 0 || Date.now() - dump.mtimeMs > 86400000) {
  throw new Error('A nonempty backup restored within the last 24 hours is required');
}
const testUrl = new URL(sourceUrl);
testUrl.pathname = '/' + rehearsal.testDatabase;
const expectedPending = [
  '20260906_retire_cancellation_fees', '20260909_audit_integrity',
  '20260911_normalize_legacy_staff_status', '20260915_remove_manager_role',
];
const approvedUsers = rehearsal.before.managerUsers;
if (!Array.isArray(approvedUsers) || approvedUsers.length !== 1) throw new Error('This deployment is approved for exactly one Manager');

async function summary(client) {
  const counts = (await client.query(`SELECT
    (SELECT count(*) FROM users) AS users,
    (SELECT count(*) FROM staff_profiles) AS staff_profiles,
    (SELECT count(*) FROM staff_branch_assignments) AS staff_branch_assignments,
    (SELECT count(*) FROM bookings) AS bookings,
    (SELECT count(*) FROM booking_services) AS booking_services`)).rows[0];
  const managerData = (await client.query(`WITH profiles AS (
    SELECT * FROM staff_profiles WHERE user_id=ANY($1::text[])
  ), items AS (SELECT * FROM booking_services WHERE staff_id IN (SELECT id FROM profiles))
  SELECT
    (SELECT md5(coalesce(string_agg(to_jsonb(p)::text,',' ORDER BY id),'')) FROM profiles p) AS profiles,
    (SELECT md5(coalesce(string_agg(to_jsonb(a)::text,',' ORDER BY id),'')) FROM staff_branch_assignments a WHERE staff_id IN (SELECT id FROM profiles)) AS assignments,
    (SELECT md5(coalesce(string_agg(to_jsonb(i)::text,',' ORDER BY id),'')) FROM items i) AS services,
    (SELECT md5(coalesce(string_agg(to_jsonb(b)::text,',' ORDER BY id),'')) FROM bookings b WHERE id IN (SELECT booking_id FROM items)) AS bookings`, [approvedUsers])).rows[0];
  return { counts, managerData };
}
function assertPreserved(actual) {
  for (const key of ['counts', 'managerData']) {
    if (JSON.stringify(actual[key]) !== JSON.stringify(rehearsal.before[key])) {
      throw new Error(`Source ${key} changed since rehearsal; take a new backup and rehearse again`);
    }
  }
}
const result = { sourceDatabase: rehearsal.sourceDatabase, rehearsal: manifestPath, state: 'PREFLIGHT' };
const client = new pg.Client({ connectionString: sourceUrl.toString() });
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const migrations = (await client.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations')).rows;
  if (migrations.some((m) => !m.finished_at && !m.rolled_back_at)) throw new Error('Failed migration requires review');
  const pending = expectedPending.filter((name) => !migrations.some((m) => m.migration_name === name && m.finished_at));
  if (pending.length !== expectedPending.length) throw new Error('This one-time deployment expects all four reviewed pending migrations');
  const test = new pg.Client({ connectionString: testUrl.toString() });
  try {
    await test.connect();
    const applied = (await test.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL')).rows;
    for (const name of expectedPending) {
      const sql = await readFile(resolve(backend, 'prisma/migrations', name, 'migration.sql'));
      const checksum = createHash('sha256').update(sql).digest('hex');
      if (!applied.some((m) => m.migration_name === name && m.checksum === checksum)) {
        throw new Error(`Migration differs from restored rehearsal: ${name}`);
      }
    }
  } finally { await test.end(); }
  const active = (await client.query(`SELECT count(*) AS count FROM pg_stat_activity
    WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'`)).rows[0];
  if (Number(active.count) > 0) throw new Error('Close application database connections before this maintenance deployment');
  const conditions = (await client.query(`SELECT
    (SELECT count(*) FROM cancellation_policies WHERE late_cancel_fee_percent<>0 OR no_show_fee_percent<>0) AS fee_policies,
    (SELECT count(*) FROM staff_profiles WHERE status::text='ON_LEAVE') AS on_leave,
    (SELECT count(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.code::text='BRANCH_MANAGER') AS managers,
    (SELECT count(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.code::text='BRANCH_MANAGER' AND ur.user_id=ANY($1::text[])) AS approved_managers`, [approvedUsers])).rows[0];
  if (conditions.fee_policies !== '0' || conditions.on_leave !== '0'
    || conditions.managers !== '1' || conditions.approved_managers !== '1') throw new Error('Reviewed data conditions changed');
  const checkResults = await client.query(await readFile(resolve(backend, 'scripts/audit-integrity-preflight.sql'), 'utf8'));
  const checks = checkResults.flatMap((r) => r.rows);
  if (checks.length !== 95 || checks.some((r) => Number(r.violations) !== 0)) throw new Error('Integrity preflight failed; do not repair/delete rows automatically');
  result.before = await summary(client);
  assertPreserved(result.before);
  await client.query('ROLLBACK');
  result.state = 'PREFLIGHT_PASSED';
  console.log(JSON.stringify({ state: result.state, checks: checks.length, pending, counts: result.before.counts }));
  if (process.argv.includes('--apply')) {
    result.state = 'DEPLOYING';
    await new Promise((done, reject) => {
      const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
        cwd: backend, env: process.env, windowsHide: true, stdio: 'inherit',
      });
      child.once('error', reject);
      child.once('exit', (code) => code === 0 ? done() : reject(new Error(`Migration deploy failed (${code}); inspect before retrying`)));
    });
    await client.query('BEGIN READ ONLY');
    result.after = await summary(client);
    assertPreserved(result.after);
    result.roles = (await client.query(`SELECT r.code::text AS code,count(ur.id) AS assignments
      FROM roles r LEFT JOIN user_roles ur ON ur.role_id=r.id GROUP BY r.code ORDER BY r.code::text`)).rows;
    const conversion = (await client.query(`SELECT bool_and(ur.id IS NOT NULL
      AND (to_jsonb(ur)-'role_id')=(a.snapshot-'role_id') AND r.code::text='RECEPTIONIST') AS valid,
      count(*) AS count FROM archive_20260915_manager_retirement a
      LEFT JOIN user_roles ur ON ur.id=a.entity_key LEFT JOIN roles r ON r.id=ur.role_id
      WHERE a.entity_table='user_roles'`)).rows[0];
    const sessions = (await client.query(`SELECT count(*) AS total,
      count(*) FILTER(WHERE s.id IS NULL OR s.revoked_at IS NULL OR s.refresh_token_hash IS NOT NULL) AS invalid
      FROM archive_20260915_manager_retirement a LEFT JOIN user_sessions s ON s.id=a.entity_key
      WHERE a.entity_table='user_sessions'`)).rows[0];
    if (conversion.valid !== true || conversion.count !== '1' || sessions.invalid !== '0'
      || result.roles.some((r) => r.code === 'BRANCH_MANAGER')) throw new Error('Post-deploy verification needs review');
    await client.query('ROLLBACK');
    result.state = 'VERIFIED';
    console.log(JSON.stringify({ state: result.state, counts: result.after.counts, roles: result.roles, revokedSessions: sessions.total, historyFingerprintPreserved: true }));
  }
} catch (error) {
  result.failure = error.code || error.message;
  console.error(JSON.stringify({ state: result.state, failure: result.failure }));
  process.exitCode = 1;
} finally {
  await client.end();
  if (process.argv.includes('--apply')) {
    const stamp = new Date().toISOString().replace(/[^0-9]/g, '');
    await writeFile(resolve(backupRoot, `manager-deployment-${stamp}.json`), JSON.stringify(result, null, 2), { flag: 'wx' });
  }
}
