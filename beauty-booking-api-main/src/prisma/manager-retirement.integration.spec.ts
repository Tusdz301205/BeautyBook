import { Pool } from 'pg';
import { ROLE_PERMISSIONS } from '../common/permissions/permission-catalog';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';
if (enabled && (!/(^|[_/])(test|e2e)(_|$)/i.test(new URL(process.env.DATABASE_URL ?? '').pathname) || process.env.NODE_ENV === 'production')) {
  throw new Error('Manager migration tests require a disposable test/e2e database');
}

(enabled ? describe : describe.skip)('Manager retirement on migrated PostgreSQL', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  afterAll(async () => { await pool.end(); });

  test('active enums exclude Manager and historical HR columns retain their old enum', async () => {
    const enums = await pool.query<{ typname: string; enumlabel: string }>(`SELECT t.typname,e.enumlabel
      FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typname IN ('RoleCode','SalonMemberRole')`);
    expect(enums.rows.some((row) => ['BRANCH_MANAGER', 'MANAGER'].includes(row.enumlabel))).toBe(false);
    const archives = await pool.query<{ table_name: string; udt_name: string }>(`SELECT table_name,udt_name
      FROM information_schema.columns WHERE table_schema='public' AND column_name='role_code'
        AND table_name IN ('archive_20260829_compensation_assignments','archive_20260829_staff_schedule_segments')`);
    expect(archives.rows).toHaveLength(2);
    expect(archives.rows.every((row) => row.udt_name === 'RoleCode_archive_20260915')).toBe(true);
  });

  test('converted grants preserve all fields except role_id, and old Salon sessions are revoked', async () => {
    const grants = await pool.query<{ valid: boolean }>(`SELECT bool_and(
      (to_jsonb(ur)-'role_id') = (a.snapshot-'role_id') AND r.code::text='RECEPTIONIST') AS valid
      FROM archive_20260915_manager_retirement a
      LEFT JOIN user_roles ur ON ur.id=a.entity_key LEFT JOIN roles r ON r.id=ur.role_id
      WHERE a.entity_table='user_roles'`);
    // The rehearsed source has one Manager; a clean installation may have none.
    expect(grants.rows[0].valid === true || grants.rows[0].valid === null).toBe(true);
    const sessions = await pool.query<{ count: string }>(`SELECT count(*)
      FROM archive_20260915_manager_retirement a LEFT JOIN user_sessions s ON s.id=a.entity_key
      WHERE a.entity_table='user_sessions'
        AND (s.id IS NULL OR s.revoked_at IS NULL OR s.refresh_token_hash IS NOT NULL)`);
    expect(sessions.rows[0].count).toBe('0');
  });

  test('persisted account-role permissions match runtime while Guest remains unassigned history only', async () => {
    const { rows } = await pool.query<{ role: string; permission: string }>(`SELECT r.code::text AS role,p.code AS permission
      FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id`);
    const expected = Object.entries(ROLE_PERMISSIONS).flatMap(([role, permissions]) => permissions.map((permission) => `${role}:${permission}`)).sort();
    const activeRows = rows.filter((row) => row.role !== 'GUEST');
    expect(activeRows.map((row) => `${row.role}:${row.permission}`).sort()).toEqual(expected);
    expect(rows.filter((row) => row.role === 'GUEST').map((row) => row.permission).sort()).toEqual([
      'branch:read:public',
      'canonical_service:read:public',
      'combo:read:public',
      'review:read:public',
      'service:read:public',
    ]);
    const assignments = await pool.query<{ count: string }>(`SELECT count(*) FROM user_roles ur
      JOIN roles r ON r.id=ur.role_id WHERE r.code::text='GUEST'`);
    expect(assignments.rows[0].count).toBe('0');
  });

  test('scope guard still rejects branchless receptionist and mismatched tenant assignments', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{ id: string }>(`SELECT ur.id FROM user_roles ur JOIN roles r ON r.id=ur.role_id
        WHERE r.code::text='RECEPTIONIST' LIMIT 1`);
      if (!rows[0]) throw new Error('Rehearsal fixture requires receptionist');
      await client.query('SAVEPOINT guard_branch');
      await expect(client.query('UPDATE user_roles SET branch_id=NULL WHERE id=$1', [rows[0].id])).rejects.toMatchObject({ code: 'P0001' });
      await client.query('ROLLBACK TO guard_branch');
      await expect(client.query('UPDATE user_roles SET business_id=NULL WHERE id=$1', [rows[0].id])).rejects.toMatchObject({ code: 'P0001' });
      await client.query('ROLLBACK TO guard_branch');
      await expect(client.query(`UPDATE user_roles SET business_id=(
        SELECT b.id FROM businesses b WHERE b.id<>user_roles.business_id LIMIT 1
      ) WHERE id=$1`, [rows[0].id])).rejects.toMatchObject({ code: 'P0001' });
    } finally { await client.query('ROLLBACK'); client.release(); }
  });
});
