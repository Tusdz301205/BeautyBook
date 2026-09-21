import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PERMISSIONS, ROLE_LEVELS, ROLE_PERMISSIONS } from './permission-catalog';

const sql = readFileSync(resolve(__dirname, '../../../prisma/migrations/20260915_remove_manager_role/migration.sql'), 'utf8');
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

describe('Manager retirement migration contract', () => {
  it('persists current account-role grants and only the approved historical Guest grants', () => {
    const grantBlock = sql.split('INSERT INTO _target_grants VALUES\n')[1].split(';')[0];
    const actual = grantBlock.split('\n').map((line) => line.trim().replace(/,$/, '')).sort();
    const expected = Object.entries(ROLE_PERMISSIONS).flatMap(([role, permissions]) => permissions.map((code) => `(${quote(role)},${quote(code)})`)).sort();
    const historicalGuest = [
      'branch:read:public',
      'canonical_service:read:public',
      'combo:read:public',
      'review:read:public',
      'service:read:public',
    ].map((code) => `('GUEST',${quote(code)})`).sort();
    expect(actual.filter((grant) => !grant.startsWith("('GUEST',"))).toEqual(expected);
    expect(actual.filter((grant) => grant.startsWith("('GUEST',"))).toEqual(historicalGuest);
  });

  it('includes all catalog permission definitions and retained role levels', () => {
    for (const p of PERMISSIONS) expect(sql).toContain(`(${[p.code, p.resource, p.action, p.defaultScope, p.description].map(quote).join(',')})`);
    for (const role of Object.keys(ROLE_PERMISSIONS)) expect(sql).toContain(quote(ROLE_LEVELS[role]));
    expect(sql).toContain('CREATE TYPE "RoleCode" AS ENUM (\'PLATFORM_ADMIN\',\'BUSINESS_OWNER\',\'RECEPTIONIST\',\'STAFF\',\'CUSTOMER\',\'GUEST\')');
    expect(sql).toContain('CREATE TYPE "SalonMemberRole" AS ENUM (\'OWNER\',\'RECEPTIONIST\')');
  });

  it('archives before changing grants and preserves booking/staff data', () => {
    expect(sql.indexOf("SELECT 'user_roles'")).toBeLessThan(sql.indexOf('UPDATE user_roles'));
    expect(sql.indexOf("SELECT 'role_permissions'")).toBeLessThan(sql.indexOf('DELETE FROM role_permissions'));
    expect(sql).not.toMatch(/(?:UPDATE|DELETE FROM|DROP TABLE|TRUNCATE)\s+"?(?:users|staff_profiles|staff_branch_assignments|bookings|booking_services)\b/i);
    expect(sql).not.toMatch(/DROP TYPE\s+"RoleCode_archive_20260915"/);
    expect(sql).not.toMatch(/DROP\s+[^;]+\sCASCADE\s*;/i);
  });

  it('fails closed on unapproved data shapes and revokes only affected salon sessions', () => {
    expect(sql).toContain('more than one existing assignment');
    expect(sql).toContain('duplicate receptionist scope');
    expect(sql).toContain('Manager membership/invitation appeared after approval');
    expect(sql).toContain('user_id IN (SELECT user_id FROM _manager_grants)');
    expect(sql).toContain("workspace::text='SALON' AND revoked_at IS NULL");
    expect(sql).toContain("to_jsonb(current_grant)-'role_id'");
    expect(sql).toContain('BEGIN;');
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
  });
});
