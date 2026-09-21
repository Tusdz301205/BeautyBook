import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const id = process.env.BEAUTYBOOK_DEPLOYMENT_ID;
assert.match(id ?? '', /^\d{12,14}$/);
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.pathname, '/glowbook_db');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
assert.equal(url.searchParams.has('options'), false, 'Verification must not bypass maintenance');
const root = resolve(`../tmp/main-deployment-${id}`);
assert.equal(JSON.parse(readFileSync(resolve(root, 'main-deploy.json'))).status, 'PASS');
const result = { startedAt: new Date().toISOString(), status: 'RUNNING', steps: [] };
async function run(label, args, cwd = process.cwd()) {
  console.log('START ' + label);
  const code = await new Promise((ok, no) => {
    const p = spawn(process.execPath, args, { cwd, env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    p.stdout.on('data', b => output += b); p.stderr.on('data', b => output += b);
    p.on('error', no);
    p.on('close', code => { writeFileSync(resolve(root, label + '.log'), output.replaceAll(process.env.DATABASE_URL, '[DATABASE]')); ok(code); });
  });
  result.steps.push({ label, code });
  assert.equal(code, 0, label + ' failed; keep maintenance enabled');
  console.log(label + ' PASS');
}
try {
  for (const cmd of ['validate', 'generate']) await run('main-' + cmd, ['node_modules/prisma/build/index.js', cmd]);
  await run('main-migrate-status', ['node_modules/prisma/build/index.js', 'migrate', 'status']);
  await run('main-controlled-diff', ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma']);
  assert.equal(readFileSync(resolve(root, 'main-controlled-diff.log'), 'utf8'), readFileSync(resolve(root, 'controlled-diff.log'), 'utf8'), 'Main diff differs from reviewed copy diff');
  await run('main-backend-build', ['node_modules/@nestjs/cli/bin/nest.js', 'build']);
  const web = resolve('../beauty-booking-web-main/beauty-booking-web-main');
  await run('main-frontend-build', [resolve(web, 'node_modules/vite/bin/vite.js'), 'build'], web);
  result.status = 'PASS';
} catch (error) { result.status = 'FAILED'; result.error = error.message; throw error; }
finally { result.finishedAt = new Date().toISOString(); writeFileSync(resolve(root, 'main-verification.json'), JSON.stringify(result, null, 2)); }
