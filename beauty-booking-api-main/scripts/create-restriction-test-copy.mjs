import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import pg from 'pg';

const source = new URL(process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(source.hostname));
assert.equal(source.pathname, '/glowbook_db');
const target = process.env.BEAUTYBOOK_TEST_DATABASE;
assert.match(target ?? '', /^beautybook_test_restriction_[0-9]+$/);
const backup = resolve('../docs/db-backups', `${target}.dump`);
const env = { ...process.env, PGPASSWORD: decodeURIComponent(source.password) };
const args = ['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username)];
async function run(executable, extra) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(`C:/Program Files/PostgreSQL/18/bin/${executable}.exe`, [...args, ...extra], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolvePromise() : reject(new Error(`${executable}: ${output}`)));
  });
}
const adminUrl = new URL(source); adminUrl.pathname = '/postgres';
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
try {
  assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [target])).rowCount, 0, 'Refusing to overwrite a database');
  await run('pg_dump', ['-Fc', '-f', backup, '-d', 'glowbook_db']);
  await admin.query(`CREATE DATABASE "${target}"`);
  await run('pg_restore', ['--no-owner', '--no-acl', '--exit-on-error', '-d', target, backup]);
  console.log(JSON.stringify({ source: 'glowbook_db (read-only dump)', testDatabase: target, backup, result: 'COPY_CREATED' }));
} finally { await admin.end(); }
