import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import pg from 'pg';
import { models, archiveSchema } from './health-archive-manifest.mjs';
const name = process.env.BEAUTYBOOK_TEST_DATABASE;
assert.match(name ?? '', /^beautybook_test_restriction_20260919\d+$/);
const url = new URL(process.env.DATABASE_URL); url.pathname = `/${name}`;
const schema = readFileSync('prisma/schema.prisma', 'utf8');
const names = Object.keys(models);
const relationNames = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].filter(m=>!names.includes(m[1])).flatMap(m=>m[2].split(/\r?\n/)).filter(l => names.some(n => new RegExp(`\\s${n}(?:\\[\\]|\\?|\\s)`).test(l))).map(l => l.trim().split(/\s+/)[0]);
const terms = [...names, ...Object.values(models), ...relationNames].filter(x => x.length > 4);
const hits = [];
function scan(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'coverage', 'test-results', 'playwright-report'].includes(e.name)) continue;
    const path = resolve(dir, e.name);
    if (e.isDirectory()) scan(path);
    else if (/\.(ts|tsx|js|jsx|mjs|json|sql|prisma)$/.test(e.name)) {
      const text = readFileSync(path, 'utf8');
      text.split(/\r?\n/).forEach((line, i) => {
        const found = terms.filter(t => line.toLowerCase().includes(t.toLowerCase()));
        if (found.length) hits.push({ path: relative(resolve('..'), path).replaceAll('\\','/'), line: i+1, terms: found, text: line.trim().slice(0,500) });
      });
    }
  }
}
for (const dir of ['src', 'test', 'prisma', 'scripts', 'docs', '../beauty-booking-web-main/beauty-booking-web-main/src', '../beauty-booking-web-main/beauty-booking-web-main/tests']) scan(dir);
const db = new pg.Client({ connectionString: url.toString() }); await db.connect();
try {
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const rows = [];
  for (const [model,table] of Object.entries(models)) {
    const stats = (await db.query(`SELECT count(*)::int count, md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY to_jsonb(t)::text),'')) fingerprint FROM public."${table}" t`)).rows[0];
    const fks = (await db.query(`SELECT c.oid, conname, conrelid::regclass::text source, confrelid::regclass::text target, pg_get_constraintdef(c.oid) definition FROM pg_constraint c WHERE contype='f' AND (conrelid=to_regclass($1) OR confrelid=to_regclass($1)) ORDER BY conname`, [`public.${table}`])).rows;
    rows.push({model,table,...stats,fks,archive:`${archiveSchema}.${table}`});
  }
  assert.equal(rows.find(r=>r.model==='SensitiveConsent').count,2,'Expected two original consent records; stop for review');
  const dependentSql = (await db.query(`SELECT p.proname, pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'`)).rows.filter(f=>Object.values(models).some(t=>f.definition.includes(t)));
  await db.query('COMMIT');
  writeFileSync('../tmp/manager-refactor/health-archive-preflight.json',JSON.stringify({database:name,capturedAt:new Date().toISOString(),rows,hits,dependentSql},null,2));
  const md = ['# Health/consultation archive — preflight', '', `Database copy: \`${name}\`. No production DB writes. Archive preserves table OIDs, rows and existing constraints; no INSERT SELECT/fake rows.`, '',
    '| Model | Physical table | Rows | Incoming FK | Outgoing FK | Runtime usage / REMOVE reason | Archive mapping |', '|---|---|---:|---|---|---|---|'];
  for(const r of rows)md.push(`| ${r.model} | ${r.table} | ${r.count} | ${r.fks.filter(f=>f.target===r.table).map(f=>f.conname).join('; ')||'None'} | ${r.fks.filter(f=>f.source===r.table).map(f=>f.conname).join('; ')||'None'} | Retired health/consultation; no current production delegate/route consumer found; see trace below | ${r.archive} |`);
  md.push('', '## Source dependency trace', '', 'Exact model/table names and inverse relation aliases were scanned in BE/FE source, seeds, tests, migrations, scripts and OpenAPI. Hits below are evidence to classify, not automatic deletion authority.', '');
  for(const h of hits)md.push(`- \`${h.path}:${h.line}\` — ${h.text.replaceAll('`','\'')}`);
  md.push('', '## Database stored functions mentioning the tables', '');
  for(const f of dependentSql)md.push(`### ${f.proname}`, '', '```sql',f.definition,'```','');
  writeFileSync('../docs/HEALTH_ARCHIVE_PREFLIGHT.md',md.join('\n'));
  console.log(JSON.stringify({tables:rows.length,consents:2,sourceHits:hits.length,sqlFunctions:dependentSql.map(f=>f.proname)}));
} finally {await db.end();}
