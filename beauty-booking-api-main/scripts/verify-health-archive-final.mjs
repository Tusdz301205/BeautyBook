import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { models, archiveSchema } from './health-archive-manifest.mjs';
const rehearsal=JSON.parse(readFileSync('../tmp/manager-refactor/health-archive-rehearsal.json','utf8'));
assert.equal(rehearsal.database,process.env.BEAUTYBOOK_TEST_DATABASE);
assert.match(rehearsal.database,/^beautybook_test_restriction_20260919\d+$/);
const mainUrl=new URL(process.env.DATABASE_URL);assert.equal(mainUrl.pathname,'/glowbook_db');
const copyUrl=new URL(mainUrl);copyUrl.pathname='/'+rehearsal.database;
const result={checkedAt:new Date().toISOString(),mainReadOnly:true,mainConsentUnchanged:false,archiveUnchangedAfterTests:false};
for(const [role,url] of [['main',mainUrl],['copy',copyUrl]]) {
  const db=new pg.Client({connectionString:url.toString()});await db.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    for(const t of Object.values(models)) {
      const ns=role==='main'?'public':archiveSchema;
      const stats=(await db.query(`SELECT count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY to_jsonb(t)::text),'')) fingerprint FROM "${ns}"."${t}" t`)).rows[0];
      assert.equal(stats.count,rehearsal.before[t].count);assert.equal(stats.fingerprint,rehearsal.before[t].fingerprint,`${role}: ${t} changed`);
    }
    if(role==='main') {
      const active=(await db.query('SELECT count(*)::int count FROM pg_tables WHERE schemaname=\'public\' AND tablename=ANY($1)',[Object.values(models)])).rows[0].count;
      assert.equal(active,12);
      const migrations=(await db.query(`SELECT migration_name FROM _prisma_migrations WHERE migration_name IN ('20260916_account_separation','20260917_booking_violation_events','20260918_customer_booking_policy','20260919_archive_retired_health','20260919_health_archive_row_guard') AND finished_at IS NOT NULL AND rolled_back_at IS NULL`)).rows;
      assert.equal(migrations.length,0);
      const count=(await db.query('SELECT count(*)::int count FROM bookings')).rows[0].count;assert.equal(count,4000);
      result.mainBookings=count;result.mainActiveHealthTables=active;result.mainConsentUnchanged=true;result.mainNewMigrationsApplied=0;
    }else result.archiveUnchangedAfterTests=true;
    await db.query('COMMIT');
  }finally{await db.end();}
}
const api='http://localhost:3102/api/v1';
// Prove this API sees a copy-only fixture before any authenticated runtime check.
const login=await fetch(api+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'khach0001@glowbook.vn',password:'Password123!'})});
assert.equal(login.status,200);const session=await login.json();
const headers={Authorization:`Bearer ${session.accessToken}`};
const marker=process.env.BEAUTYBOOK_COPY_BOOKING_ID;assert.ok(marker);
assert.equal((await fetch(api+'/bookings/'+marker,{headers})).status,200);
const privacy=await fetch(api+'/privacy/center',{headers});assert.equal(privacy.status,200);
const payload=await privacy.json();assert.deepEqual(payload.sections.shares,[]);assert.deepEqual(payload.sections.accessHistory,[]);
result.privacyCenterWithoutRetiredTables=true;
writeFileSync('../tmp/manager-refactor/health-archive-final-verification.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
