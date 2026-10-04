// Create a NEW isolated database. Never seed/reset/drop the source database.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import pg from 'pg';
const config = { ...dotenv.parse(readFileSync('.env')), ...(existsSync('.env.local') ? dotenv.parse(readFileSync('.env.local')) : {}) };
const sourceUrl = new URL(config.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(sourceUrl.hostname));
assert.notEqual(config.NODE_ENV, 'production');
const database = `beautybook_test_restriction_${Date.now()}`;
const output = resolve('../docs/full-system-qa/evidence/current');
const runtime = resolve('../report-output/full-system-qa');
mkdirSync(output, { recursive: true }); mkdirSync(runtime, { recursive: true });
const source = new pg.Client({ connectionString: sourceUrl.toString() }); await source.connect();
const counts = (await source.query('SELECT (SELECT count(*)::int FROM users) users, (SELECT count(*)::int FROM bookings) bookings')).rows[0];
const catalog = {};
for (const table of ['roles','permissions','role_permissions']) catalog[table] = (await source.query(`SELECT * FROM ${table}`)).rows;
const adminUrl = new URL(sourceUrl); adminUrl.pathname = '/postgres';
const admin = new pg.Client({ connectionString: adminUrl.toString() }); await admin.connect();
assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount, 0);
await admin.query(`CREATE DATABASE "${database}"`); await admin.end();
const bin = process.env.BEAUTYBOOK_PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const args = ['-h',sourceUrl.hostname,'-p',sourceUrl.port || '5432','-U',decodeURIComponent(sourceUrl.username)];
async function cli(program, extra) {
  await new Promise((ok,no) => {
    const child = spawn(resolve(bin,program), [...args,...extra], { windowsHide:true, stdio:['ignore','ignore','pipe'], env:{...process.env,PGPASSWORD:decodeURIComponent(sourceUrl.password)} });
    let err=''; child.stderr.on('data',d=>err+=d); child.on('error',no); child.on('exit',code=>code===0?ok():no(new Error(`${program}: ${err.slice(0,600)}`)));
  });
}
const schema = resolve(runtime,'schema.sql');
await cli('pg_dump.exe',['--dbname',sourceUrl.pathname.slice(1),'--schema-only','--no-owner','--no-acl','--file',schema]);
writeFileSync(schema,readFileSync(schema,'utf8').replace('CREATE SCHEMA public;','CREATE SCHEMA IF NOT EXISTS public;'));
await cli('psql.exe',['-X','--dbname',database,'--set','ON_ERROR_STOP=1','--file',schema]);
const testUrl = new URL(sourceUrl); testUrl.pathname=`/${database}`;
const db = new pg.Client({connectionString:testUrl.toString()}); await db.connect();
for (const [table,rows] of Object.entries(catalog)) for (const row of rows) await db.query(`INSERT INTO ${table} SELECT * FROM json_populate_record(NULL::${table}, $1::json)`,[JSON.stringify(row)]);
await db.end();
const after=(await source.query('SELECT (SELECT count(*)::int FROM users) users, (SELECT count(*)::int FROM bookings) bookings')).rows[0]; assert.deepEqual(after,counts); await source.end();
const env = {
 DATABASE_URL:testUrl.toString(), DIRECT_URL:testUrl.toString(), NODE_ENV:'test', PORT:'3012',
 EMAIL_USER:'', EMAIL_PASS:'', REDIS_URL:'', JWT_SECRET:randomBytes(32).toString('hex'), JWT_REFRESH_SECRET:randomBytes(32).toString('hex'),
 SENSITIVE_DATA_ENCRYPTION_KEY:randomBytes(32).toString('base64'), CORS_ORIGINS:'http://localhost:5176,http://localhost:8083',
 FRONTEND_URL:'http://localhost:5176', UPLOAD_DIR:resolve(runtime,'uploads'), QA_PASSWORD:randomBytes(18).toString('base64url')+'aA1!',
 QA_DATABASE:database, QA_OUTPUT:output, QA_RUNTIME:runtime,
};
// Contains local-only test secrets: excluded by existing report-output ignore.
writeFileSync(resolve(runtime,'runtime.json'),JSON.stringify(env));
writeFileSync(resolve(output,'environment.json'),JSON.stringify({database,api:'http://localhost:3012/api/v1',web:'http://localhost:5176',sourceReadOnly:true,sourceCountsBefore:counts,sourceCountsAfterPreparation:after,copied:'schema + permissions catalog ONLY',smtpDisabled:true,redis:'in-memory (single process)',createdAt:new Date().toISOString()},null,2));
console.log(`Created isolated ${database}; source counts unchanged; no user data copied.`);
