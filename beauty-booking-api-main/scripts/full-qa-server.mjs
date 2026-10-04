import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const env = JSON.parse(readFileSync('../report-output/full-system-qa/runtime.json','utf8'));
assert.match(new URL(env.DATABASE_URL).pathname,/^\/beautybook_test_restriction_\d+$/);
assert.equal(env.NODE_ENV,'test');
const child=spawn(process.execPath,['dist/src/main.js'],{windowsHide:true,stdio:'inherit',env:{...process.env,...env}});
process.on('SIGINT',()=>child.kill()); process.on('SIGTERM',()=>child.kill()); child.on('exit',code=>process.exitCode=code||0);
