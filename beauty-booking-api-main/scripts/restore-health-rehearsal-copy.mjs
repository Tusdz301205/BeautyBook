import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import pg from 'pg';
const name=process.env.BEAUTYBOOK_TEST_DATABASE;
assert.match(name??'',/^beautybook_test_restriction_20260919\d+$/);
const url=new URL(process.env.DATABASE_URL);assert.ok(['localhost','127.0.0.1'].includes(url.hostname));url.pathname='/postgres';
const db=new pg.Client({connectionString:url.toString()});await db.connect();
try {
  assert.equal((await db.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount,0,'Never overwrite');
  await db.query(`CREATE DATABASE "${name}"`);
  await new Promise((ok,no)=>{const p=spawn('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe',['-h',url.hostname,'-p',url.port||'5432','-U',decodeURIComponent(url.username),'--no-owner','--no-acl','--exit-on-error','-d',name,resolve('../docs/db-backups/beautybook_test_restriction_2026091901-before-health-archive.dump')],{env:{...process.env,PGPASSWORD:decodeURIComponent(url.password)},windowsHide:true,stdio:['ignore','pipe','pipe']});let error='';p.stderr.on('data',b=>error+=b);p.on('error',no);p.on('exit',c=>c===0?ok():no(new Error(error)));});
  console.log(JSON.stringify({restored:name,source:'pre-archive backup; no main DB mutation'}));
}finally{await db.end();}
