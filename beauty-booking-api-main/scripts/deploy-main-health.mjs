import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,copyFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import pg from 'pg';
import {models,retiredEnums,archiveSchema} from './health-archive-manifest.mjs';
const chain=['20260916_account_separation','20260917_booking_violation_events','20260918_customer_booking_policy','20260919_archive_retired_health','20260919_health_archive_row_guard'];
const deploymentId=process.env.BEAUTYBOOK_DEPLOYMENT_ID ?? '202609192250';
assert.match(deploymentId,/^\d{12,14}$/,'Deployment ID must be a timestamp');
const verification=`beautybook_test_restriction_${deploymentId}`;
const root=resolve(`../tmp/main-deployment-${deploymentId}`);mkdirSync(root,{recursive:true});
const source=new URL(process.env.DATABASE_URL);assert.equal(source.pathname,'/glowbook_db');assert.ok(['localhost','127.0.0.1'].includes(source.hostname));
const q=s=>'"'+s.replaceAll('"','""')+'"';
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=readdirSync('prisma/migrations',{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name).sort();assert.equal(files.length,47);
const hashes=Object.fromEntries(files.map(n=>[n,hash(readFileSync(`prisma/migrations/${n}/migration.sql`))]));
async function connect(name,maintenance=false){const u=new URL(source);u.pathname='/'+name;if(maintenance)u.searchParams.set('options','-c default_transaction_read_only=off');const d=new pg.Client({connectionString:u.toString(),application_name:'beautybook-controlled-deployment'});await d.connect();return d;}
async function history(d){return (await d.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY started_at')).rows;}
function validHistory(h){assert.ok(!h.some(r=>!r.finished_at&&!r.rolled_back_at),'Failed migration exists');for(const r of h)assert.equal(hashes[r.migration_name],r.checksum,r.migration_name+' checksum mismatch');}
function pending(h){return files.filter(n=>!h.some(r=>r.migration_name===n&&r.finished_at&&!r.rolled_back_at));}
async function snapshot(d){const data={};for(const t of (await d.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','archive_health_20260919') AND tablename<>'_prisma_migrations' ORDER BY tablename")).rows){data[t.tablename]=(await d.query(`SELECT count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY to_jsonb(t)::text),'')) fingerprint FROM ${q(t.schemaname)}.${q(t.tablename)} t`)).rows[0];}return data;}
async function orphan(d){const fks=(await d.query(`SELECT n.nspname ns,t.relname tab,pn.nspname pns,p.relname parent,c.conname,
 ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) cols,
 ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord) pcols
 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_class p ON p.oid=c.confrelid JOIN pg_namespace pn ON pn.oid=p.relnamespace WHERE c.contype='f' AND n.nspname IN ('public','archive_health_20260919')`)).rows;
 for(const f of fks){const a=f.cols.map(c=>`s.${q(c)} IS NOT NULL`).join(' AND '),b=f.cols.map((c,i)=>`p.${q(f.pcols[i])}=s.${q(c)}`).join(' AND ');assert.equal((await d.query(`SELECT count(*)::int n FROM ${q(f.ns)}.${q(f.tab)} s WHERE ${a} AND NOT EXISTS(SELECT 1 FROM ${q(f.pns)}.${q(f.parent)} p WHERE ${b})`)).rows[0].n,0,f.conname+' orphan');}return fks.length;}
async function run(label,args,env){await new Promise((ok,no)=>{const p=spawn(process.execPath,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let text='';p.stdout.on('data',b=>text+=b);p.stderr.on('data',b=>text+=b);p.on('error',no);p.on('exit',code=>{writeFileSync(resolve(root,label+'.log'),text.replaceAll(env.DATABASE_URL,'[DATABASE]'));code===0?ok():no(new Error(label+' exit '+code));});});}
async function objects(d,i){const checks={};
 const triggers=(await d.query("SELECT tgname,tgtype::int FROM pg_trigger WHERE NOT tgisinternal")).rows;
 assert.ok(triggers.some(t=>t.tgname==='account_role_separation_guard'));
 if(i>=1){assert.equal((await d.query('SELECT count(*)::int n FROM booking_violation_events')).rows[0].n,0);for(const n of ['booking_violation_source_valid','booking_violation_evidence_immutable'])assert.ok(triggers.some(t=>t.tgname===n));
 const cs=(await d.query("SELECT conname FROM pg_constraint WHERE conrelid='booking_violation_events'::regclass")).rows;for(const n of ['booking_violation_source_check','booking_violation_void_check'])assert.ok(cs.some(c=>c.conname===n));
 checks.eventIndexes=(await d.query("SELECT indexname,indexdef FROM pg_indexes WHERE tablename='booking_violation_events'")).rows;assert.equal(checks.eventIndexes.length,5);
 }
 if(i>=2){assert.equal((await d.query('SELECT count(*)::int n FROM customer_booking_policies')).rows[0].n,0);assert.ok(triggers.some(t=>t.tgname==='customer_booking_policy_scope'));assert.equal((await d.query("SELECT count(*)::int n FROM pg_constraint WHERE conrelid='customer_booking_policies'::regclass AND contype='f'")).rows[0].n,3);}
 if(i>=3){for(const t of Object.values(models)){assert.deepEqual((await d.query('SELECT to_regclass($1) IS NULL absent,to_regclass($2) IS NOT NULL archived',[`public.${t}`,`${archiveSchema}.${t}`])).rows[0],{absent:true,archived:true});}
 assert.equal((await d.query('SELECT count(*)::int n FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=$1 AND t.typname=ANY($2)',[archiveSchema,retiredEnums])).rows[0].n,10);}
 if(i>=4){const g=(await d.query("SELECT tgname,tgtype::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND tgname LIKE 'retired_health_archive_%'",[archiveSchema])).rows;
 assert.equal(g.filter(t=>t.tgname==='retired_health_archive_read_only'&&t.tgtype===31).length,12);assert.equal(g.filter(t=>t.tgname==='retired_health_archive_no_truncate'&&t.tgtype===34).length,12);checks.archiveGuards=g;
 }
 return checks;
}
const mode=process.argv[2];
if(mode==='prepare'){
 const main=await connect('glowbook_db'),copy=await connect(verification);try{
 await main.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await copy.query('BEGIN READ ONLY');
 const h=await history(main);validHistory(h);assert.deepEqual(pending(h),chain);assert.deepEqual(await history(copy),h);
 const before=await snapshot(main);assert.deepEqual(await snapshot(copy),before);assert.equal(before.sensitive_consents.count,2);
 const backup=resolve('../docs/db-backups',verification+'.dump');assert.ok(statSync(backup).size>1000000);
 const result={checkedAt:new Date().toISOString(),database:'glowbook_db',backup,backupSize:statSync(backup).size,backupSha256:hash(readFileSync(backup)),restoreDatabase:verification,restoreVerified:true,before,history:h,hashes,fkCount:await orphan(main)};
 writeFileSync(resolve(root,'baseline.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,before:undefined,history:undefined,hashes:undefined}));
 await main.query('ROLLBACK');await copy.query('ROLLBACK');
 }finally{await main.end();await copy.end();}
}else if(mode==='verify-copy'){
 const baseline=JSON.parse(readFileSync(resolve(root,'baseline.json')));
 assert.deepEqual(hashes,baseline.hashes);
 const main=await connect('glowbook_db'),copy=await connect(verification);
 try {
  await main.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await copy.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.deepEqual(JSON.parse(JSON.stringify(await history(main))),baseline.history);
  assert.deepEqual(await snapshot(main),baseline.before,'Main changed since backup');
  validHistory(await history(copy));assert.deepEqual(pending(await history(copy)),[]);
  const after=await snapshot(copy);
  for(const table of Object.values(models))assert.deepEqual(after[table],baseline.before[table],table+' archive changed after tests');
  const verificationResult={checkedAt:new Date().toISOString(),mainUnchanged:true,archiveUnchanged:true,consents:after.sensitive_consents.count,mainFkCount:await orphan(main),copyFkCount:await orphan(copy),orphans:0};
  writeFileSync(resolve(root,'copy-post-test-integrity.json'),JSON.stringify(verificationResult,null,2));console.log(JSON.stringify(verificationResult));
 }finally{await main.end();await copy.end();}
}else if(mode==='release-maintenance'){
 for(const file of ['main-deploy.json','main-verification.json','main-read-smoke.json'])assert.equal(JSON.parse(readFileSync(resolve(root,file))).status,'PASS',file);
 const baseline=JSON.parse(readFileSync(resolve(root,'baseline.json')));assert.deepEqual(hashes,baseline.hashes);
 const main=await connect('glowbook_db'),admin=await connect('postgres');
 try {
  assert.equal((await main.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
  validHistory(await history(main));assert.deepEqual(pending(await history(main)),[]);
  const after=await snapshot(main);
  for(const t of ['businesses','branches','staff_profiles','bookings','booking_services','payments','reviews',...Object.values(models)])assert.deepEqual(after[t],baseline.before[t],t+' changed unexpectedly');
  assert.equal(after.users.count,baseline.before.users.count); // Authorized login updates last_login_at/session/security metadata only.
  const fkCount=await orphan(main);
  assert.deepEqual((await main.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()")).rows,[]);
  await admin.query('ALTER DATABASE "glowbook_db" RESET default_transaction_read_only');
  const probe=await connect('glowbook_db');try{assert.equal((await probe.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'off');}finally{await probe.end();}
  const result={releasedAt:new Date().toISOString(),status:'PASS',fkCount,orphans:0,consents:after.sensitive_consents.count,criticalBusinessRowsUnchanged:true,authorizedLoginMetadataChanged:true,ordinaryConnectionsReadWrite:true};
  writeFileSync(resolve(root,'maintenance-release.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await main.end();await admin.end();}
}else if(mode==='copy-deploy'||mode==='main-deploy'){
 const isMain=mode==='main-deploy',name=isMain?'glowbook_db':verification;
 const baseline=JSON.parse(readFileSync(resolve(root,'baseline.json')));assert.deepEqual(hashes,baseline.hashes);
 if(isMain){
  assert.equal(JSON.parse(readFileSync(resolve(root,'copy-deploy.json'))).status,'PASS');
  assert.equal(JSON.parse(readFileSync(resolve(root,'copy-verification.json'))).status,'PASS_REQUIRES_DIFF_REVIEW');
  assert.equal(JSON.parse(readFileSync(resolve(root,'copy-read-smoke.json'))).status,'PASS');
  const tests=JSON.parse(readFileSync(resolve(root,'jest-results.json')));
  assert.equal(tests.numFailedTests,0);assert.equal(tests.numPendingTests,0);assert.ok(tests.numPassedTests>=934);
  assert.equal(process.env.BEAUTYBOOK_DIFF_REVIEWED,'1','Explicit controlled diff review required');
  const freshId=process.env.BEAUTYBOOK_FRESH_BACKUP_ID;assert.match(freshId??'',/^\d{12,14}$/);
  const fresh=JSON.parse(readFileSync(resolve(`../tmp/main-deployment-${freshId}/baseline.json`)));
  assert.equal(fresh.restoreVerified,true);assert.deepEqual(fresh.before,baseline.before);assert.deepEqual(fresh.history,baseline.history);assert.deepEqual(fresh.hashes,hashes);
  assert.equal(hash(readFileSync(fresh.backup)),fresh.backupSha256);
  assert.ok(Date.now()-Date.parse(fresh.checkedAt)<30*60*1000,'Fresh verified backup must be under 30 minutes old');
  writeFileSync(resolve(root,'fresh-backup-reference.json'),JSON.stringify({backup:fresh.backup,sha256:fresh.backupSha256,restoreDatabase:fresh.restoreDatabase,verifiedAt:fresh.checkedAt},null,2));
 }
 const admin=await connect('postgres'),normal=await connect(name);let d;const result={database:name,startedAt:new Date().toISOString(),status:'IN_PROGRESS',checkpoints:[]};
 try{
 await normal.query('BEGIN READ ONLY');validHistory(await history(normal));assert.deepEqual(pending(await history(normal)),chain);assert.deepEqual(await snapshot(normal),baseline.before);
 const connections=(await normal.query("SELECT pid,application_name,state FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()")).rows;assert.deepEqual(connections,[],'Existing connections: stop traffic before maintenance');await normal.query('ROLLBACK');await normal.end();
 const settings=(await admin.query('SELECT setconfig FROM pg_db_role_setting WHERE setdatabase=(SELECT oid FROM pg_database WHERE datname=$1) AND setrole=0',[name])).rows;
 assert.ok(!settings.some(r=>(r.setconfig??[]).some(v=>v.startsWith('default_transaction_read_only='))),'Unexpected pre-existing maintenance setting');
 // New ordinary connections inherit read-only transactions. Only this runner's
 // explicitly scoped maintenance connection/Prisma process opts out.
 await admin.query(`ALTER DATABASE ${q(name)} SET default_transaction_read_only TO on`);
 result.maintenance='default_transaction_read_only=on';writeFileSync(resolve(root,mode+'.json'),JSON.stringify(result,null,2));
 const probe=await connect(name);try{assert.equal((await probe.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');}finally{await probe.end();}
 d=await connect(name,true);assert.equal((await d.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'off');
 for(let i=0;i<chain.length;i++){
 const allowed=files.filter(n=>!chain.includes(n)||chain.indexOf(n)<=i),stage=resolve(root,mode+'-stage-'+(i+1));mkdirSync(stage,{recursive:true});
 for(const n of allowed){mkdirSync(resolve(stage,n),{recursive:true});copyFileSync(`prisma/migrations/${n}/migration.sql`,resolve(stage,n,'migration.sql'));}copyFileSync('prisma/migrations/migration_lock.toml',resolve(stage,'migration_lock.toml'));
 const u=new URL(source);u.pathname='/'+name;u.searchParams.set('options','-c default_transaction_read_only=off -c lock_timeout=10000');
 await run(mode+'-'+chain[i],['node_modules/prisma/build/index.js','migrate','deploy','--config','prisma.deployment.config.ts'],{...process.env,DATABASE_URL:u.toString(),BEAUTYBOOK_STAGED_MIGRATIONS:stage});
 const h=await history(d);validHistory(h);assert.deepEqual(pending(h),chain.slice(i+1));
 const after=await snapshot(d);for(const [t,stats] of Object.entries(baseline.before))assert.deepEqual(after[t],stats,t+' changed');
 result.checkpoints.push({migration:chain[i],checkedAt:new Date().toISOString(),historyVerified:true,originalRowsUnchanged:true,fkCount:await orphan(d),objects:await objects(d,i)});
 writeFileSync(resolve(root,mode+'.json'),JSON.stringify(result,null,2));console.log(name+': '+chain[i]+' PASS');
 }
 result.status='PASS';result.finishedAt=new Date().toISOString();result.after=await snapshot(d);
 if(!isMain){await admin.query(`ALTER DATABASE ${q(name)} RESET default_transaction_read_only`);result.maintenance='released on verification copy';}
 writeFileSync(resolve(root,mode+'.json'),JSON.stringify(result,null,2));
 }catch(error){result.status='FAILED';result.error=error.message;writeFileSync(resolve(root,mode+'.json'),JSON.stringify(result,null,2));throw error;}
 finally{await d?.end();await normal.end().catch(()=>{});await admin.end();}
}else throw new Error('Unknown mode');
