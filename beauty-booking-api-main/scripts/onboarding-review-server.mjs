// Dedicated, empty local QA database. Source database is read only; never reset,
// seed, migrate, overwrite or drop it. Test database is retained for inspection.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import pg from 'pg';

const configured = {
  ...dotenv.parse(readFileSync('.env')),
  ...(existsSync('.env.local') ? dotenv.parse(readFileSync('.env.local')) : {}),
};
const sourceUrl = new URL(configured.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(sourceUrl.hostname), 'Only a local source is allowed');
assert.notEqual(configured.NODE_ENV, 'production');
const database = `beautybook_test_onboarding_${Date.now()}`;
assert.match(database, /^beautybook_test_onboarding_\d+$/);
const output = resolve('../report-output/business-owner-registration');
mkdirSync(output, { recursive: true });
const bin = process.env.BEAUTYBOOK_PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const pgEnv = { ...process.env, PGPASSWORD: decodeURIComponent(sourceUrl.password) };
const connectionArgs = ['-h', sourceUrl.hostname, '-p', sourceUrl.port || '5432', '-U', decodeURIComponent(sourceUrl.username)];

async function command(program, args) {
  await new Promise((ok, no) => {
    const child = spawn(resolve(bin, program), args, { env: pgEnv, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let diagnostic = '';
    child.stderr.on('data', (data) => { diagnostic += data; });
    child.on('error', no);
    child.on('exit', (code) => code === 0 ? ok() : no(new Error(`${program} failed: ${diagnostic.slice(0, 700)}`)));
  });
}

const source = new pg.Client({ connectionString: sourceUrl.toString(), application_name: 'onboarding-qa-schema-reader' });
const adminUrl = new URL(sourceUrl); adminUrl.pathname = '/postgres';
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await source.connect(); await admin.connect();
const counts = (await source.query('SELECT (SELECT count(*)::int FROM users) users, (SELECT count(*)::int FROM bookings) bookings')).rows[0];
const roles = (await source.query('SELECT * FROM roles')).rows;
assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount, 0);
await admin.query(`CREATE DATABASE "${database}"`);
await admin.end();
const schemaPath = resolve(output, `${database}-schema.sql`);
await command('pg_dump.exe', [...connectionArgs, '--dbname', sourceUrl.pathname.slice(1), '--schema-only', '--schema=public', '--no-owner', '--no-acl', '--file', schemaPath]);
// New PostgreSQL databases already contain public. Keep that schema intact.
writeFileSync(schemaPath, readFileSync(schemaPath, 'utf8').replace('CREATE SCHEMA public;', 'CREATE SCHEMA IF NOT EXISTS public;'));
await command('psql.exe', [...connectionArgs, '-X', '--dbname', database, '--set', 'ON_ERROR_STOP=1', '--file', schemaPath]);
const testUrl = new URL(sourceUrl); testUrl.pathname = `/${database}`;
const testDb = new pg.Client({ connectionString: testUrl.toString() }); await testDb.connect();
// Copy only the role catalog needed for real public registration, no user data.
for (const role of roles) {
  await testDb.query('INSERT INTO roles SELECT * FROM json_populate_record(NULL::roles, $1::json)', [JSON.stringify(role)]);
}
await testDb.end();
const after = (await source.query('SELECT (SELECT count(*)::int FROM users) users, (SELECT count(*)::int FROM bookings) bookings')).rows[0];
assert.deepEqual(after, counts);
await source.end();
writeFileSync(resolve(output, 'local-fixture.json'), JSON.stringify({
  database, createdAt: new Date().toISOString(), api: 'http://localhost:3011/api/v1', web: 'http://localhost:5175',
  sourceReadOnly: true, copied: 'public schema and roles only', sourceCountsBefore: counts, sourceCountsAfterPreparation: after,
  smtpDisabled: true, uploadDir: resolve(output, 'uploads'),
}, null, 2));
console.log(`Isolated QA database ready: ${database}; API port 3011; SMTP disabled.`);
const api = spawn(process.execPath, ['dist/src/main.js'], {
  windowsHide: true, stdio: 'inherit', env: {
    ...process.env, DATABASE_URL: testUrl.toString(), DIRECT_URL: testUrl.toString(), NODE_ENV: 'test', PORT: '3011',
    EMAIL_USER: '', EMAIL_PASS: '', REDIS_URL: '',
    JWT_SECRET: randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    CORS_ORIGINS: 'http://localhost:5175', FRONTEND_URL: 'http://localhost:5175', UPLOAD_DIR: resolve(output, 'uploads'),
  },
});
process.on('SIGINT', () => api.kill());
process.on('SIGTERM', () => api.kill());
api.on('exit', (code) => { process.exitCode = code || 0; });
