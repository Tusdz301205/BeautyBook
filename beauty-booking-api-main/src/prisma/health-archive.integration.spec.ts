import { Pool } from 'pg';
import { Prisma } from '@prisma/client';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';
if (enabled && (!/^\/beautybook_test_restriction_\d+$/.test(new URL(process.env.DATABASE_URL ?? '').pathname) || process.env.NODE_ENV !== 'test')) {
  throw new Error('Health archive integration requires its dedicated rehearsal copy');
}
const tables = ['sensitive_consents', 'booking_health_records', 'health_record_access_logs', 'consultation_form_templates',
  'consultation_form_versions', 'consultation_form_fields', 'service_consultation_requirements', 'consultation_submissions',
  'sensitive_answers', 'consent_events', 'sensitive_data_access_events', 'sensitive_break_glass_grants'];
(enabled ? describe : describe.skip)('Retired health archive isolation', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  afterAll(async () => { await pool.end(); });
  test.each(tables)('%s exists only in archive, not active public schema', async table => {
    const { rows } = await pool.query('SELECT to_regclass($1) IS NULL inactive, to_regclass($2) IS NOT NULL preserved', [`public.${table}`, `archive_health_20260919.${table}`]);
    expect(rows).toEqual([{ inactive: true, preserved: true }]);
  });
  test('generated Prisma exposes no retired table/model', () => {
    expect(Prisma.dmmf.datamodel.models.filter(m => tables.includes(m.dbName ?? ''))).toEqual([]);
    expect(Prisma.dmmf.datamodel.models).toHaveLength(121);
  });
  test('both original consent records retain their customer reference', async () => {
    const { rows } = await pool.query(`SELECT count(*)::int count FROM archive_health_20260919.sensitive_consents c JOIN public.customer_profiles p ON p.id=c.customer_id WHERE c.id IS NOT NULL AND c.granted_at IS NOT NULL AND c.policy_version IS NOT NULL`);
    expect(rows).toEqual([{ count: 2 }]);
  });
  test('parent cascade cannot delete archived consent history', async () => {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await expect(db.query('DELETE FROM public.customer_profiles WHERE id=(SELECT customer_id FROM archive_health_20260919.sensitive_consents LIMIT 1)'))
        .rejects.toMatchObject({ code: expect.stringMatching(/^(55000|23001|23503)$/) });
    } finally { await db.query('ROLLBACK'); db.release(); }
  });
  test('actual archive writes are forbidden, no-op cascades stay harmless', async () => {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('UPDATE archive_health_20260919.sensitive_consents SET granted=granted WHERE false');
      await expect(db.query('UPDATE archive_health_20260919.sensitive_consents SET granted=granted')).rejects.toMatchObject({ code: '55000' });
    } finally { await db.query('ROLLBACK'); db.release(); }
  });
  test('legacy append-only access-log triggers remain attached', async () => {
    const { rows } = await pool.query(`SELECT tgname FROM pg_trigger WHERE tgrelid='archive_health_20260919.health_record_access_logs'::regclass AND NOT tgisinternal ORDER BY tgname`);
    expect(rows.map(r => r.tgname)).toEqual(['health_access_logs_no_delete', 'health_access_logs_no_update', 'retired_health_archive_no_truncate', 'retired_health_archive_read_only']);
  });
  test('archive TRUNCATE is rejected without losing historical rows', async () => {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      // All retired tables are included so FK checks do not mask the archive guard.
      await expect(db.query(`TRUNCATE ${tables.map(table => `archive_health_20260919.${table}`).join(', ')}`))
        .rejects.toMatchObject({ code: '55000' });
    } finally { await db.query('ROLLBACK'); db.release(); }
    expect((await pool.query('SELECT count(*)::int count FROM archive_health_20260919.sensitive_consents')).rows)
      .toEqual([{ count: 2 }]);
  });
});
