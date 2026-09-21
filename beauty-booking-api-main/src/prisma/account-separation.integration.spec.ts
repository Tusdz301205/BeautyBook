import { randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';
if (enabled && (!/(^|[_/])(test|e2e)(_|$)/i.test(new URL(process.env.DATABASE_URL ?? '').pathname) || process.env.NODE_ENV === 'production')) {
  throw new Error('Account separation integration requires a disposable test/e2e database');
}

(enabled ? describe : describe.skip)('Account separation database guard', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ids: string[] = [];
  let businessId: string;
  let branchId: string;
  const roles = new Map<string, string>();

  beforeAll(async () => {
    const rows = await pool.query<{ id: string; code: string }>('SELECT id,code::text FROM roles');
    rows.rows.forEach((row) => roles.set(row.code, row.id));
    const branch = await pool.query<{ id: string; business_id: string }>('SELECT id,business_id FROM branches LIMIT 1');
    branchId = branch.rows[0].id; businessId = branch.rows[0].business_id;
  });
  afterAll(async () => {
    // Only fixtures created by this suite; no seeded/historical accounts.
    await pool.query('DELETE FROM user_roles WHERE user_id=ANY($1::text[])', [ids]);
    await pool.query('DELETE FROM users WHERE id=ANY($1::text[])', [ids]);
    await pool.end();
  });

  async function account() {
    const id = randomUUID(); ids.push(id);
    await pool.query(`INSERT INTO users(id,email,password_hash,full_name,updated_at)
      VALUES($1,$2,'TEST_DISABLED','Account separation test',now())`, [id, `${id}@example.test`]);
    return id;
  }
  function grant(client: Pool | PoolClient, userId: string, code: string, expiresAt: Date | null = null) {
    return client.query(`INSERT INTO user_roles(id,user_id,role_id,business_id,branch_id,expires_at)
      VALUES($1,$2,$3,$4,$5,$6)`, [randomUUID(), userId, roles.get(code),
      ['BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF'].includes(code) ? businessId : null,
      ['RECEPTIONIST', 'STAFF'].includes(code) ? branchId : null, expiresAt]);
  }
  test.each(['BUSINESS_OWNER', 'RECEPTIONIST', 'STAFF', 'PLATFORM_ADMIN'])(
    'rejects Customer + %s in both grant orders', async (code) => {
      for (const [first, second] of [['CUSTOMER', code], [code, 'CUSTOMER']]) {
        const id = await account();
        await grant(pool, id, first);
        await expect(grant(pool, id, second)).rejects.toMatchObject({ code: '23514', constraint: 'account_role_separation_guard' });
        expect((await pool.query('SELECT count(*)::int AS count FROM user_roles WHERE user_id=$1', [id])).rows[0].count).toBe(1);
      }
    },
  );
  test('expired grants remain as history but cannot be renewed into a mixed account', async () => {
    const id = await account();
    await grant(pool, id, 'STAFF', new Date('2000-01-01T00:00:00Z'));
    await grant(pool, id, 'CUSTOMER');
    await expect(pool.query('UPDATE user_roles SET expires_at=NULL WHERE user_id=$1 AND role_id=$2', [id, roles.get('STAFF')]))
      .rejects.toMatchObject({ code: '23514', constraint: 'account_role_separation_guard' });
    expect((await pool.query('SELECT count(*)::int AS count FROM user_roles WHERE user_id=$1', [id])).rows[0].count).toBe(2);
  });
  test('simultaneous Customer and operational grants cannot both commit', async () => {
    const id = await account();
    const a = await pool.connect(); const b = await pool.connect();
    try {
      await a.query('BEGIN'); await b.query('BEGIN');
      await grant(a, id, 'CUSTOMER');
      const second = grant(b, id, 'STAFF').then(() => ({ success: true, code: '' }), (error: { code: string }) => ({ success: false, code: error.code }));
      await a.query('COMMIT');
      expect(await second).toEqual({ success: false, code: '23514' });
      expect((await pool.query('SELECT count(*)::int AS count FROM user_roles WHERE user_id=$1', [id])).rows[0].count).toBe(1);
    } finally { await a.query('ROLLBACK'); await b.query('ROLLBACK'); a.release(); b.release(); }
  });
});
