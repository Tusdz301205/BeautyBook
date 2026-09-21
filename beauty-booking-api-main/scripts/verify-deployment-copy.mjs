import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import pg from 'pg';

const id = process.env.BEAUTYBOOK_DEPLOYMENT_ID;
assert.match(id ?? '', /^\d{12,14}$/);
const deploymentRoot = resolve(`../tmp/main-deployment-${id}`);
const postMainCopy = process.env.BEAUTYBOOK_POST_MAIN_COPY;
const verificationLabel = process.env.BEAUTYBOOK_VERIFICATION_LABEL ?? 'post-main';
assert.match(verificationLabel, /^[a-z0-9-]+$/);
const root = postMainCopy ? resolve(deploymentRoot, verificationLabel) : deploymentRoot;
mkdirSync(root, { recursive: true });
assert.equal(JSON.parse(readFileSync(resolve(deploymentRoot, postMainCopy ? 'maintenance-release.json' : 'copy-deploy.json'))).status, 'PASS');
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.pathname, '/glowbook_db');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
if (postMainCopy) {
  assert.match(postMainCopy, /^beautybook_test_restriction_\d{12,14}$/);
  const copyUrl = new URL(url); copyUrl.pathname = '/' + postMainCopy;
  const quote = s => '"' + s.replaceAll('"', '""') + '"';
  async function snapshot(connectionString) {
    const db = new pg.Client({ connectionString }); await db.connect();
    try {
      await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const data = {};
      for (const t of (await db.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','archive_health_20260919') ORDER BY schemaname,tablename")).rows) {
        data[t.schemaname + '.' + t.tablename] = (await db.query(`SELECT count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY to_jsonb(t)::text),'')) fingerprint FROM ${quote(t.schemaname)}.${quote(t.tablename)} t`)).rows[0];
      }
      return data;
    } finally { await db.end(); }
  }
  const before = await snapshot(url.toString());
  assert.deepEqual(await snapshot(copyUrl.toString()), before, 'Post-main copy differs from main');
  assert.equal(before['archive_health_20260919.sensitive_consents'].count, 2);
  writeFileSync(resolve(root, 'restore-proof.json'), JSON.stringify({ checkedAt: new Date().toISOString(), database: postMainCopy, mainEquivalent: true, before }, null, 2));
  url.pathname = '/' + postMainCopy;
} else url.pathname = `/beautybook_test_restriction_${id}`;
const env = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test', RUN_POSTGRES_INTEGRATION: '1' };
const result = { database: url.pathname.slice(1), startedAt: new Date().toISOString(), status: 'RUNNING', steps: [] };
async function run(label, args) {
  console.log('START ' + label);
  const code = await new Promise((ok, no) => {
    const p = spawn(process.execPath, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    p.stdout.on('data', b => output += b);
    p.stderr.on('data', b => output += b);
    p.on('error', no);
    p.on('close', code => {
      writeFileSync(resolve(root, label + '.log'), output.replaceAll(env.DATABASE_URL, '[DATABASE]'));
      ok(code);
    });
  });
  result.steps.push({ label, code });
  assert.equal(code, 0, label + ' failed; stop deployment');
  console.log(label + ' PASS');
}
try {
  await run('validate', ['node_modules/prisma/build/index.js', 'validate']);
  await run('generate', ['node_modules/prisma/build/index.js', 'generate']);
  await run('controlled-diff', ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma']);
  await run('backend-build', ['node_modules/@nestjs/cli/bin/nest.js', 'build']);
  await run('full-postgres-tests', ['node_modules/jest/bin/jest.js', '--runInBand', '--json', '--outputFile=' + resolve(root, 'jest-results.json')]);
  result.status = 'PASS_REQUIRES_DIFF_REVIEW';
} catch (error) {
  result.status = 'FAILED';
  result.error = error.message;
  throw error;
} finally {
  result.finishedAt = new Date().toISOString();
  writeFileSync(resolve(root, 'copy-verification.json'), JSON.stringify(result, null, 2));
}
