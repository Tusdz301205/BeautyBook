import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

// Read-only evidence from the configured main database. No DDL or row writes.
const decisions = JSON.parse(readFileSync('../docs/schema-audit-decisions.json', 'utf8'));
const schema = readFileSync('prisma/schema.prisma', 'utf8');
const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(match => ({
  model: match[1], table: /@@map\("([a-z0-9_]+)"\)/.exec(match[2])?.[1],
}));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const rows = [];
  for (const model of models.filter(m => decisions.models[m.model]?.action !== 'KEEP')) {
    if (!/^[a-z0-9_]+$/.test(model.table ?? '')) throw new Error(`Unsafe table name: ${model.model}`);
    const exists = (await db.query('SELECT to_regclass($1) IS NOT NULL AS present', [`public.${model.table}`])).rows[0].present;
    const count = exists ? (await db.query(`SELECT count(*)::int AS count FROM "${model.table}"`)).rows[0].count : null;
    const fks = (await db.query(`SELECT conrelid::regclass::text AS source, confrelid::regclass::text AS target,
      conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE contype='f' AND (conrelid=to_regclass($1) OR confrelid=to_regclass($1)) ORDER BY conname`, [`public.${model.table}`])).rows;
    rows.push({ ...model, exists, count, fks });
  }
  const migrations = (await db.query('SELECT migration_name, finished_at IS NOT NULL AS applied FROM _prisma_migrations WHERE rolled_back_at IS NULL ORDER BY migration_name')).rows;
  const bookingCount = (await db.query('SELECT count(*)::int AS count FROM bookings')).rows[0].count;
  await db.query('COMMIT');
  const result = { capturedAt: new Date().toISOString(), databaseRole: 'configured-main-read-only', bookingCount, migrations, rows };
  writeFileSync('../tmp/manager-refactor/schema-cleanup-evidence-20260919.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ tablesRead: rows.length, bookingCount, pendingPolicyMigrations: ['20260916_account_separation', '20260917_booking_violation_events', '20260918_customer_booking_policy'].filter(n => !migrations.some(m => m.migration_name === n && m.applied)) }));
} finally { await db.end(); }
