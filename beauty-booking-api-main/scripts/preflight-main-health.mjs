// Read-only gate. Never performs DDL/DML or migration history changes.
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { models } from './health-archive-manifest.mjs';
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.pathname, '/glowbook_db');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
const quote = s => '"' + s.replaceAll('"', '""') + '"';
const files = readdirSync('prisma/migrations').filter(n => existsSync(`prisma/migrations/${n}/migration.sql`)).sort();
const hashes = Object.fromEntries(files.map(n => [n, createHash('sha256').update(readFileSync(`prisma/migrations/${n}/migration.sql`)).digest('hex')]));
const result = { checkedAt: new Date().toISOString(), readOnly: true, databases: {}, failures: [] };
for (const name of ['glowbook_db', 'beautybook_test_restriction_2026091903']) {
  const u = new URL(url); u.pathname = '/' + name;
  const db = new pg.Client({ connectionString: u.toString(), application_name: 'beautybook-readonly-preflight' });
  await db.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await db.query("SET LOCAL statement_timeout = '60s'");
    const history = (await db.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY started_at')).rows;
    const pending = files.filter(n => !history.some(h => h.migration_name === n && h.finished_at && !h.rolled_back_at));
    const mismatch = history.filter(h => hashes[h.migration_name] !== h.checksum);
    const failed = history.filter(h => !h.finished_at && !h.rolled_back_at);
    if (mismatch.length || failed.length) result.failures.push({ name, mismatch, failed });
    result.databases[name] = { history, pending };
    if (name === 'glowbook_db') {
      result.tables = {};
      const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' ORDER BY tablename")).rows;
      for (const { tablename: t } of tables) result.tables[t] = (await db.query(`SELECT count(*)::int count, md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY to_jsonb(t)::text),'')) fingerprint FROM public.${quote(t)} t`)).rows[0];
      for (const t of Object.values(models)) if (!result.tables[t]) result.failures.push({ missingHealthTable: t });
      if (result.tables.sensitive_consents?.count !== 2) result.failures.push('Consent count is not two');
      const rehearsal = JSON.parse(readFileSync('../tmp/manager-refactor/health-archive-rehearsal.json','utf8'));
      for (const t of Object.values(models)) if (result.tables[t]?.fingerprint !== rehearsal.before[t].fingerprint) result.failures.push({ healthFingerprintChanged: t });
      result.connections = (await db.query("SELECT pid,application_name,client_addr,state,backend_type,xact_start,wait_event_type,wait_event FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()")).rows;
      result.constraints = (await db.query("SELECT n.nspname,c.relname,k.conname,k.contype,k.convalidated,pg_get_constraintdef(k.oid) definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname")).rows;
      const catalog = {
        constraints: result.constraints,
        columns: (await db.query("SELECT table_schema,table_name,column_name,ordinal_position,data_type,udt_schema,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows,
        indexes: (await db.query("SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname")).rows,
        triggers: (await db.query("SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname")).rows,
        enums: (await db.query("SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder")).rows,
      };
      result.schemaFingerprint = createHash('sha256').update(JSON.stringify(catalog)).digest('hex');
      const fks = (await db.query(`SELECT k.conname,c.relname tab,p.relname parent,pn.nspname pns,
        ARRAY(SELECT a.attname::text FROM unnest(k.conkey) WITH ORDINALITY x(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=x.num ORDER BY x.ord) cols,
        ARRAY(SELECT a.attname::text FROM unnest(k.confkey) WITH ORDINALITY x(num,ord) JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=x.num ORDER BY x.ord) pcols
        FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_class p ON p.oid=k.confrelid JOIN pg_namespace pn ON pn.oid=p.relnamespace WHERE k.contype='f' AND n.nspname='public'`)).rows;
      result.fkCount = fks.length; result.orphans = [];
      for (const f of fks) {
        const nonnull = f.cols.map(c=>`s.${quote(c)} IS NOT NULL`).join(' AND ');
        const match = f.cols.map((c,i)=>`p.${quote(f.pcols[i])}=s.${quote(c)}`).join(' AND ');
        const {count} = (await db.query(`SELECT count(*)::int count FROM public.${quote(f.tab)} s WHERE ${nonnull} AND NOT EXISTS(SELECT 1 FROM ${quote(f.pns)}.${quote(f.parent)} p WHERE ${match})`)).rows[0];
        if (count) result.orphans.push({constraint:f.conname,count});
      }
      if (result.orphans.length) result.failures.push({orphans:result.orphans});
    }
    await db.query('ROLLBACK');
  } finally { await db.end(); }
}
const main = result.databases.glowbook_db;
const copy = result.databases.beautybook_test_restriction_2026091903;
for (const h of main.history) if (!copy.history.some(c=>c.migration_name===h.migration_name&&c.checksum===h.checksum&&Boolean(c.finished_at)===Boolean(h.finished_at)&&Boolean(c.rolled_back_at)===Boolean(h.rolled_back_at))) result.failures.push({historyMismatch:h.migration_name});
result.order = main.pending.map((migration,i)=>({order:i+1,migration,checksum:hashes[migration],rehearsed:copy.history.some(h=>h.migration_name===migration&&h.checksum===hashes[migration]&&h.finished_at&&!h.rolled_back_at)}));
if (result.order.some(x=>!x.rehearsed)) result.failures.push('Pending migration not rehearsed');
writeFileSync('../tmp/manager-refactor/main-health-preflight.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({order:result.order,tableCount:Object.keys(result.tables).length,fkCount:result.fkCount,orphans:result.orphans,connections:result.connections,failures:result.failures}));
if (result.failures.length) process.exitCode=1;
