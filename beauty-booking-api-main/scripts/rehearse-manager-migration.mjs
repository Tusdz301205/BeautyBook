/** Read the source DB, back it up, restore into a new local test DB, then migrate
 * only that test DB. This script NEVER deploys to DATABASE_URL or seeds data.
 * The local dump contains sensitive data and stays under ignored db-backups.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceUrl = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(sourceUrl.hostname)) {
  throw new Error('Rehearsal is limited to a local PostgreSQL source');
}
const stamp = new Date().toISOString().replace(/[^0-9]/g, '');
const testDatabase = `beautybook_test_manager_${stamp}`;
if (!/^beautybook_test_manager_\d+$/.test(testDatabase)) throw new Error('Unsafe test database name');
const backupDir = resolve(backend, '../docs/db-backups');
const dumpPath = resolve(backupDir, `before-manager-${stamp}.dump`);
const manifestPath = resolve(backupDir, `manager-rehearsal-${stamp}.json`);
const binaries = process.env.PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${testDatabase}`;
const pgEnv = {
  ...process.env, PGHOST: sourceUrl.hostname, PGPORT: sourceUrl.port || '5432',
  PGUSER: decodeURIComponent(sourceUrl.username), PGPASSWORD: decodeURIComponent(sourceUrl.password),
};
const manifest = { sourceDatabase: decodeURIComponent(sourceUrl.pathname.slice(1)), testDatabase, dumpPath, state: 'STARTED' };

async function run(binary, args, env) {
  await new Promise((done, reject) => {
    const child = spawn(binary, args, { cwd: backend, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (data) => { output += data.toString(); });
    child.stderr.on('data', (data) => { output += data.toString(); });
    child.once('error', reject);
    child.once('exit', (code) => {
      // Capture local tool diagnostics without displaying database contents.
      if (code !== 0) {
        manifest.lastToolOutput = output.replaceAll(sourceUrl.toString(), '[SOURCE_DATABASE]').replaceAll(testUrl.toString(), '[TEST_DATABASE]');
        reject(new Error(`Tool failed (${code}): ${binary.split(/[\\/]/).at(-1)}`));
      } else done();
    });
  });
}

async function readSummary(url, approvedUsers) {
  const client = new pg.Client({ connectionString: url.toString() });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const counts = await client.query(`SELECT
      (SELECT count(*) FROM users) AS users,
      (SELECT count(*) FROM staff_profiles) AS staff_profiles,
      (SELECT count(*) FROM staff_branch_assignments) AS staff_branch_assignments,
      (SELECT count(*) FROM bookings) AS bookings,
      (SELECT count(*) FROM booking_services) AS booking_services`);
    const roles = await client.query(`SELECT r.code::text AS code,count(ur.id) AS assignments
      FROM roles r LEFT JOIN user_roles ur ON ur.role_id=r.id GROUP BY r.code ORDER BY r.code::text`);
    const managerUsers = approvedUsers || (await client.query(`SELECT ur.user_id FROM user_roles ur
      JOIN roles r ON r.id=ur.role_id WHERE r.code::text='BRANCH_MANAGER'`)).rows.map((row) => row.user_id);
    const managerData = await client.query(`WITH profiles AS (
      SELECT * FROM staff_profiles WHERE user_id=ANY($1::text[])
    ), items AS (SELECT * FROM booking_services WHERE staff_id IN (SELECT id FROM profiles))
    SELECT
      (SELECT md5(coalesce(string_agg(to_jsonb(p)::text,',' ORDER BY id),'')) FROM profiles p) AS profiles,
      (SELECT md5(coalesce(string_agg(to_jsonb(a)::text,',' ORDER BY id),'')) FROM staff_branch_assignments a WHERE staff_id IN (SELECT id FROM profiles)) AS assignments,
      (SELECT md5(coalesce(string_agg(to_jsonb(i)::text,',' ORDER BY id),'')) FROM items i) AS services,
      (SELECT md5(coalesce(string_agg(to_jsonb(b)::text,',' ORDER BY id),'')) FROM bookings b WHERE id IN (SELECT booking_id FROM items)) AS bookings`, [managerUsers]);
    const pending = await client.query(`SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NULL AND rolled_back_at IS NULL`);
    const protectedTables = {};
    for (const table of ['users', 'customer_profiles', 'staff_profiles', 'staff_branch_assignments',
      'salon_members', 'bookings', 'booking_services', 'booking_status_histories', 'reviews',
      'loyalty_accounts', 'loyalty_transactions', 'notifications', 'audit_logs']) {
      protectedTables[table] = (await client.query(`SELECT count(*)::int AS count,
        md5(coalesce(string_agg(to_jsonb(t)::text, ',' ORDER BY id), '')) AS fingerprint FROM "${table}" t`)).rows[0];
    }
    await client.query('ROLLBACK');
    if (pending.rows.length) throw new Error('Existing unfinished migration requires inspection');
    return { counts: counts.rows[0], roles: roles.rows, managerUsers, managerData: managerData.rows[0], protectedTables };
  } finally { await client.end(); }
}

await mkdir(backupDir, { recursive: true });
try {
  manifest.before = await readSummary(sourceUrl);
  await run(resolve(binaries, 'pg_dump.exe'), ['--format=custom', '--no-owner', '--no-privileges', '--file', dumpPath, manifest.sourceDatabase], pgEnv);
  manifest.state = 'BACKUP_CREATED';
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ state: manifest.state, dumpPath }));
  const admin = new pg.Client({ connectionString: sourceUrl.toString() });
  try {
    await admin.connect();
    // Generated identifier only; never re-use or drop an existing database.
    await admin.query(`CREATE DATABASE "${testDatabase}" TEMPLATE template0`);
    manifest.state = 'TEST_DATABASE_CREATED';
  } finally { await admin.end(); }
  await run(resolve(binaries, 'pg_restore.exe'), ['--no-owner', '--no-privileges', '--exit-on-error', '--dbname', testDatabase, dumpPath], pgEnv);
  manifest.state = 'RESTORED';
  manifest.restored = await readSummary(testUrl);
  console.log(JSON.stringify({ state: manifest.state, testDatabase, counts: manifest.restored.counts }));
  await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { ...process.env, DATABASE_URL: testUrl.toString() });
  manifest.state = 'MIGRATED_TEST_DATABASE';
  manifest.after = await readSummary(testUrl, manifest.restored.managerUsers);
  if (JSON.stringify(manifest.restored.counts) !== JSON.stringify(manifest.after.counts)) throw new Error('Business data row counts changed during rehearsal');
  if (JSON.stringify(manifest.restored.managerData) !== JSON.stringify(manifest.after.managerData)) throw new Error('Manager staff/assignment/booking history changed during rehearsal');
  if (JSON.stringify(manifest.restored.protectedTables) !== JSON.stringify(manifest.after.protectedTables)) throw new Error('Protected historical rows changed during rehearsal');
  manifest.state = 'PASSED';
  console.log(JSON.stringify({ state: manifest.state, testDatabase, counts: manifest.after.counts, roles: manifest.after.roles }));
} catch (error) {
  manifest.failure = error.code || error.message;
  console.error(JSON.stringify({ state: manifest.state, failure: manifest.failure, manifestPath }));
  process.exitCode = 1;
} finally {
  // No secrets/connection URL stored; detailed diagnostic file is gitignored.
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}
