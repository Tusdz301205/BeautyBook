import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';
const integration = enabled ? describe : describe.skip;
if (enabled && (!/(^|[_/])(test|e2e)(_|$)/i.test(new URL(process.env.DATABASE_URL ?? '').pathname)
  || process.env.NODE_ENV === 'production')) {
  throw new Error('Integrity tests require a disposable test/e2e database');
}
const manifest = JSON.parse(readFileSync(join(__dirname, '../../scripts/audit-integrity-manifest.json'), 'utf8')) as {
  foreignKeys: Array<{ table: string; column: string; target: string; name: string }>;
  checks: Array<{ table: string; name: string }>;
};

integration('PostgreSQL audit integrity constraints', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  afterAll(async () => { await pool.end(); });

  test.each(manifest.foreignKeys)('$name is validated, restrictive and references the correct parent', async (fk) => {
    const { rows } = await pool.query<{ convalidated: boolean; confdeltype: string; target: string; column_name: string }>(`
      SELECT c.convalidated, c.confdeltype, p.relname AS target, a.attname AS column_name
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
      JOIN pg_class p ON p.oid=c.confrelid
      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=c.conkey[1]
      WHERE t.relname=$1 AND c.conname=$2 AND c.contype='f'`, [fk.table, fk.name]);
    expect(rows).toEqual([{ convalidated: true, confdeltype: 'r', target: fk.target, column_name: fk.column }]);
  });

  test.each(manifest.checks)('$name is a validated CHECK', async (check) => {
    const { rows } = await pool.query<{ convalidated: boolean }>(`
      SELECT c.convalidated FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
      WHERE t.relname=$1 AND c.conname=$2 AND c.contype='c'`, [check.table, check.name]);
    expect(rows).toEqual([{ convalidated: true }]);
  });

  test('raw orphaned loyalty account is rejected', async () => {
    await expect(pool.query(`INSERT INTO loyalty_accounts(id,business_id,customer_id,balance,version,updated_at)
      VALUES ($1,$2,$3,0,0,now())`, [randomUUID(), randomUUID(), randomUUID()]))
      .rejects.toMatchObject({ code: '23503' });
  });

  test('raw negative payment is rejected without changing the original row', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await expect(client.query('UPDATE payments SET amount=-1 WHERE id=(SELECT id FROM payments LIMIT 1)'))
        .rejects.toMatchObject({ code: '23514', constraint: 'payments_audit_amount_check' });
    } finally { await client.query('ROLLBACK'); client.release(); }
  });

  test('hard deleting a user with a customer profile is blocked', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Isolate this FK from bookings/requests owned by seeded customers;
      // PostgreSQL does not promise which of several restrictive FKs fires first.
      const userId = randomUUID();
      await client.query(`INSERT INTO users(id,email,password_hash,full_name,updated_at)
        VALUES($1,$2,'TEST_DISABLED','Integrity fixture',now())`, [userId, `${userId}@example.test`]);
      await client.query(`INSERT INTO customer_profiles(id,user_id,updated_at)
        VALUES($1,$2,now())`, [randomUUID(), userId]);
      await expect(client.query('DELETE FROM users WHERE id=$1', [userId]))
        .rejects.toMatchObject({
          // Require the exact FK: PostgreSQL may report either the specific
          // RESTRICT violation or the general foreign-key violation.
          code: expect.stringMatching(/^(23001|23503)$/) as unknown,
          table: 'customer_profiles',
          constraint: 'customer_profiles_user_id_fkey',
        });
    } finally { await client.query('ROLLBACK'); client.release(); }
  });

  test('all three hot-path indexes exist', async () => {
    const names = ['bookings_branch_id_appointment_date_status_idx', 'notifications_user_id_is_read_idx', 'payments_created_at_idx'];
    const { rows } = await pool.query<{ indexname: string }>('SELECT indexname FROM pg_indexes WHERE schemaname=\'public\' AND indexname=ANY($1)', [names]);
    expect(rows.map(row => row.indexname).sort()).toEqual(names.sort());
  });
});
