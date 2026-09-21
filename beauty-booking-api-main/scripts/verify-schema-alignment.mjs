import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import pg from 'pg';
import {createHash} from 'node:crypto';
const name='beautybook_test_restriction_202609192301';
const main=new URL(process.env.DATABASE_URL);assert.equal(main.pathname,'/glowbook_db');
const copy=new URL(main);copy.pathname='/'+name;
const env={...process.env,DATABASE_URL:copy.toString(),NODE_ENV:'test',RUN_POSTGRES_INTEGRATION:'1'};
const out='../tmp/schema-alignment';mkdirSync(out,{recursive:true});
const q=s=>'"'+s.replaceAll('"','""')+'"';
async function snapshot(url){const db=new pg.Client({connectionString:url.toString()});await db.connect();try{
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const tables=(await db.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','archive_health_20260919') ORDER BY tablename")).rows;
 const data={};for(const t of tables)data[t.tablename]=(await db.query(`SELECT count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY to_jsonb(t)::text),'')) fingerprint FROM ${q(t.schemaname)}.${q(t.tablename)} t`)).rows[0];
 await db.query('ROLLBACK');return data;
}finally{await db.end();}}
async function run(label,args){console.log('START '+label);await new Promise((ok,no)=>{const p=spawn(process.execPath,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('error',no);p.on('exit',code=>{writeFileSync(`${out}/${label}.log`,output);console.log(label+' exit='+code);code===0?ok():no(new Error(label+' failed; see log'));});});}
const stage=process.argv[2];
if(stage==='prepare'){
 const before=await snapshot(main);assert.deepEqual(await snapshot(copy),before,'Fresh copy must match main including migration ledger');writeFileSync(`${out}/before.json`,JSON.stringify(before,null,2));
 await run('validate',['node_modules/prisma/build/index.js','validate']);
 await run('generate',['node_modules/prisma/build/index.js','generate']);
 await run('diff-current-main-equivalent',['node_modules/prisma/build/index.js','migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma']);
}else if(stage==='copy-migrate'){
 // This deployment is confined to a fresh alignment copy, never the approved rehearsal or main.
 await run('copy-five-migrations',['node_modules/prisma/build/index.js','migrate','deploy']);
 const before=JSON.parse(readFileSync(`${out}/before.json`));const after=await snapshot(copy);
 for(const [table,stats] of Object.entries(before))if(table!=='_prisma_migrations')assert.deepEqual(after[table],stats,table+' changed');
 assert.equal(after.booking_violation_events.count,0);assert.equal(after.customer_booking_policies.count,0);
 writeFileSync(`${out}/after-copy-migrations.json`,JSON.stringify(after,null,2));
 await run('diff-post-five',['node_modules/prisma/build/index.js','migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma']);
}else if(stage==='equivalent-final'){
 const untouched=new URL(main);untouched.pathname='/beautybook_test_restriction_202609192302';
 assert.deepEqual(await snapshot(untouched),JSON.parse(readFileSync(`${out}/before.json`)),'Final main-equivalent copy mismatch');
 env.DATABASE_URL=untouched.toString();
 await run('diff-current-main-equivalent-final',['node_modules/prisma/build/index.js','migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma']);
}else if(stage==='rediff'){
 await run('validate',['node_modules/prisma/build/index.js','validate']);
 await run('generate',['node_modules/prisma/build/index.js','generate']);
 await run('diff-post-five',['node_modules/prisma/build/index.js','migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma']);
}else if(stage==='test'){
 await run('backend-build',['node_modules/@nestjs/cli/bin/nest.js','build']);
 await run('backend-postgres-tests',['node_modules/jest/bin/jest.js','--runInBand']);
}else if(stage==='main-proof'){
 const preflight=JSON.parse(readFileSync('../tmp/manager-refactor/main-health-preflight.json','utf8'));
 for(const entry of [...preflight.databases.glowbook_db.history,...preflight.order]){
 const migration=entry.migration_name??entry.migration;
 assert.equal(createHash('sha256').update(readFileSync(`prisma/migrations/${migration}/migration.sql`)).digest('hex'),entry.checksum,`Migration changed: ${migration}`);
 }
 assert.deepEqual(await snapshot(main),JSON.parse(readFileSync(`${out}/before.json`)),'Main changed since alignment baseline');
 writeFileSync(`${out}/main-unchanged.json`,JSON.stringify({checkedAt:new Date().toISOString(),mainUnchanged:true}));console.log('MAIN UNCHANGED');
 const schema=readFileSync('prisma/schema.prisma','utf8');
 const active=[...schema.matchAll(/^model \w+ \{([\s\S]*?)^\}/gm)].map(m=>m[1].match(/@@map\("([^"]+)"\)/)?.[1]).filter(Boolean);
 const diff=readFileSync(`${out}/diff-post-five.log`,'utf8');
 const changed=[...diff.matchAll(/Changed the `([^`]+)` table/g)].map(m=>m[1]);
 assert.deepEqual(changed.filter(t=>active.includes(t)),[],'Active table drift remains');
 const db=new pg.Client({connectionString:copy.toString()});await db.connect();
 try{await db.query('BEGIN READ ONLY');
 const fks=(await db.query(`SELECT n.nspname ns,t.relname tab,pn.nspname pns,p.relname parent,c.conname,
 ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) cols,
 ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord) pcols
 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_class p ON p.oid=c.confrelid JOIN pg_namespace pn ON pn.oid=p.relnamespace WHERE c.contype='f' AND n.nspname IN ('public','archive_health_20260919')`)).rows;
 for(const f of fks){const where=f.cols.map(c=>`s.${q(c)} IS NOT NULL`).join(' AND ');const match=f.cols.map((c,i)=>`p.${q(f.pcols[i])}=s.${q(c)}`).join(' AND ');
 assert.equal((await db.query(`SELECT count(*)::int count FROM ${q(f.ns)}.${q(f.tab)} s WHERE ${where} AND NOT EXISTS(SELECT 1 FROM ${q(f.pns)}.${q(f.parent)} p WHERE ${match})`)).rows[0].count,0,f.conname);}
 const before=JSON.parse(readFileSync(`${out}/before.json`));
 for(const {tablename:t} of (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='archive_health_20260919'")).rows){const r=(await db.query(`SELECT count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY to_jsonb(t)::text),'')) fingerprint FROM archive_health_20260919.${q(t)} t`)).rows[0];assert.deepEqual(r,before[t]);}
 writeFileSync(`${out}/post-test-verification.json`,JSON.stringify({checkedAt:new Date().toISOString(),activeModels:active.length,activeTablesChangedInDiff:[],fkCount:fks.length,orphans:0,archiveUnchanged:true},null,2));
 await db.query('ROLLBACK');
 }finally{await db.end();}
}else throw new Error('Unknown stage');
