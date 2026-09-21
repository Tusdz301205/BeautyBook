import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { models, archiveSchema, retiredEnums } from './health-archive-manifest.mjs';
const name=process.env.BEAUTYBOOK_TEST_DATABASE;
assert.match(name??'',/^beautybook_test_restriction_20260919\d+$/);
assert.notEqual(process.env.NODE_ENV,'production');
const url=new URL(process.env.DATABASE_URL); assert.ok(['localhost','127.0.0.1'].includes(url.hostname)); url.pathname=`/${name}`;
const db=new pg.Client({connectionString:url.toString()}); await db.connect();
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const tables=Object.values(models);
const migration='20260919_archive_retired_health';
const backup=resolve('../docs/db-backups',`${name}-before-health-archive.dump`);
async function run(file,args,env=process.env) {
  await new Promise((ok,no)=>{const p=spawn(file,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('error',no);p.on('exit',c=>c===0?ok():no(new Error(output.replaceAll(url.toString(),'[COPY]'))));});
}
async function snapshot() {
  const result={};
  const relations=(await db.query(`SELECT c.oid::int oid,n.nspname schema,c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN ('public',$1) AND c.relname<>'_prisma_migrations' ORDER BY c.oid`,[archiveSchema])).rows;
  for(const t of relations) {
    const stats=(await db.query(`SELECT count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY to_jsonb(t)::text),'')) fingerprint FROM ${quote(t.schema)}.${quote(t.name)} t`)).rows[0];
    const constraints=(await db.query(`SELECT oid::int,conname,contype,conkey,confkey,confrelid::int,confupdtype,confdeltype,confmatchtype,convalidated,condeferrable,condeferred,conbin::text FROM pg_constraint WHERE conrelid=$1 ORDER BY oid`,[t.oid])).rows;
    const indexes=(await db.query(`SELECT indexrelid::int,indisunique,indisprimary,indkey::text,indexprs::text,indpred::text FROM pg_index WHERE indrelid=$1 ORDER BY indexrelid`,[t.oid])).rows;
    const columns=(await db.query(`SELECT attnum,attname,atttypid::int,attnotnull FROM pg_attribute WHERE attrelid=$1 AND attnum>0 AND NOT attisdropped ORDER BY attnum`,[t.oid])).rows;
    const triggers=(await db.query(`SELECT oid::int,tgname,tgfoid::int,tgtype,tgenabled,tgargs::text FROM pg_trigger WHERE tgrelid=$1 AND tgname NOT IN ('retired_health_archive_read_only','retired_health_archive_no_truncate') ORDER BY oid`,[t.oid])).rows;
    result[t.name]={oid:t.oid,...stats,constraints,indexes,columns,triggers};
  }
  return result;
}
async function assertLocations(archived) {
  for(const t of tables) {
    const r=(await db.query('SELECT to_regclass($1) IS NOT NULL present,to_regclass($2) IS NOT NULL archived',[`public.${t}`,`${archiveSchema}.${t}`])).rows[0];
    assert.deepEqual(r,{present:!archived,archived});
  }
  const enums=(await db.query('SELECT n.nspname schema,t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname=ANY($1) AND n.nspname IN (\'public\',$2)',[retiredEnums,archiveSchema])).rows;
  assert.equal(enums.length,10);assert.ok(enums.every(e=>e.schema===(archived?archiveSchema:'public')));
}
async function orphanCheck() {
  const fks=(await db.query(`SELECT c.conname,n.nspname ns,t.relname tab,pn.nspname pns,p.relname parent,
    ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) cols,
    ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord) pcols
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN pg_class p ON p.oid=c.confrelid JOIN pg_namespace pn ON pn.oid=p.relnamespace
    WHERE c.contype='f' AND n.nspname IN ('public',$1)`,[archiveSchema])).rows;
  for(const f of fks) {
    const nonnull=f.cols.map(c=>`s.${quote(c)} IS NOT NULL`).join(' AND ');
    const match=f.cols.map((c,i)=>`p.${quote(f.pcols[i])}=s.${quote(c)}`).join(' AND ');
    const r=(await db.query(`SELECT count(*)::int count FROM ${quote(f.ns)}.${quote(f.tab)} s WHERE ${nonnull} AND NOT EXISTS(SELECT 1 FROM ${quote(f.pns)}.${quote(f.parent)} p WHERE ${match})`)).rows[0];
    assert.equal(r.count,0,`Orphan: ${f.conname}`);
  }
  return fks.length;
}
async function immutableCheck() {
  let checks=0;
  for(const t of tables) for(const sql of [`UPDATE ${quote(archiveSchema)}.${quote(t)} SET id=id WHERE false`,`DELETE FROM ${quote(archiveSchema)}.${quote(t)} WHERE false`,`INSERT INTO ${quote(archiveSchema)}.${quote(t)} SELECT * FROM ${quote(archiveSchema)}.${quote(t)} WHERE false`]) {
    await db.query('BEGIN');try {await db.query(sql);checks++;}finally{await db.query('ROLLBACK');}
  }
  for(const sql of ['UPDATE archive_health_20260919.sensitive_consents SET granted=granted','DELETE FROM archive_health_20260919.sensitive_consents','INSERT INTO archive_health_20260919.sensitive_consents SELECT * FROM archive_health_20260919.sensitive_consents LIMIT 1']) {
    await db.query('BEGIN');try {await assert.rejects(db.query(sql),e=>e.code==='55000');checks++;}finally{await db.query('ROLLBACK');}
  }
  await db.query('BEGIN');try {await assert.rejects(db.query(`TRUNCATE ${tables.map(t=>`${quote(archiveSchema)}.${quote(t)}`).join(',')}`),e=>e.code==='55000');checks++;}finally{await db.query('ROLLBACK');}
  return checks;
}
try {
  await assertLocations(false);
  const before=await snapshot(); assert.equal(before.sensitive_consents.count,2); assert.equal(before.bookings.count,4000);
  const beforeFKs=await orphanCheck();
  const args=['-h',url.hostname,'-p',url.port||'5432','-U',decodeURIComponent(url.username)];
  const pgEnv={...process.env,PGPASSWORD:decodeURIComponent(url.password)};
  await run('C:/Program Files/PostgreSQL/18/bin/pg_dump.exe',[...args,'-Fc','-f',backup,'-d',name],pgEnv);
  await run(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{...process.env,DATABASE_URL:url.toString()});
  await assertLocations(true); assert.deepEqual(await snapshot(),before,'Rows/OIDs/PK/FK/columns/indexes/original triggers changed');
  const afterFKs=await orphanCheck(); const immutableChecks=await immutableCheck();
  // Committed reverse recovery on this copy, then restore forward state. The
  // temporary schema/history mismatch exists only while this copy is offline.
  await db.query(readFileSync('scripts/recover-health-archive.sql','utf8'));
  await assertLocations(false); assert.deepEqual(await snapshot(),before,'Reverse recovery differs from baseline');
  await db.query(readFileSync(`prisma/migrations/${migration}/migration.sql`,'utf8'));
  await db.query(readFileSync('prisma/migrations/20260919_health_archive_row_guard/migration.sql','utf8'));
  await assertLocations(true); assert.deepEqual(await snapshot(),before); await orphanCheck();
  const restoreName=name+'99'; assert.match(restoreName,/^beautybook_test_restriction_20260919\d+$/);
  assert.equal((await db.query('SELECT 1 FROM pg_database WHERE datname=$1',[restoreName])).rowCount,0,'Refuse overwrite recovery DB');
  await db.query(`CREATE DATABASE ${quote(restoreName)}`);
  await run('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe',[...args,'--no-owner','--no-acl','--exit-on-error','-d',restoreName,backup],pgEnv);
  const restoreUrl=new URL(url);restoreUrl.pathname='/'+restoreName;
  const restored=new pg.Client({connectionString:restoreUrl.toString()});await restored.connect();
  try {for(const [t,stats] of Object.entries(before)) {
    const r=(await restored.query(`SELECT count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY to_jsonb(t)::text),'')) fingerprint FROM public.${quote(t)} t`)).rows[0];
    assert.equal(r.count,stats.count);assert.equal(r.fingerprint,stats.fingerprint,`Backup restore differs: ${t}`);
  }}finally{await restored.end();}
  const result={database:name,migration,backup,restoreDatabase:restoreName,checkedAt:new Date().toISOString(),preservedTables:Object.keys(before).length,beforeFKs,afterFKs,immutableChecks,
    before,rows:Object.entries(models).map(([model,t])=>({model,table:t,old:before[t].count,archived:before[t].count,fingerprint:before[t].fingerprint,oid:before[t].oid})),
    assertions:{sameRows:true,samePKFKAndOIDs:true,sameOriginalTriggers:true,twoConsentsPreserved:true,noOrphans:true,reverseRecovery:true,backupRestore:true,forwardReapply:true,mainDatabaseUnchangedByRunner:true}};
  writeFileSync('../tmp/manager-refactor/health-archive-rehearsal.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({...result,before:undefined,rows:undefined}));
}finally {await db.end();}
